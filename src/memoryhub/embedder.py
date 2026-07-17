"""OpenAI-compatible embeddings 客户端。

供应商是配置不是代码:任意实现 POST {base_url}/embeddings 协议的服务皆可
(阿里百炼 / 智谱 / SiliconFlow / OpenAI...)。key 只走环境变量;
维度校验是模型指纹守卫的一环——返回维度与 config.dim 不符立即报错,禁止混库。
"""

from __future__ import annotations

import time

import httpx

from .config import ENV_API_KEY, EmbeddingConfig, api_key

BATCH_SIZE = 64
_RETRY_DELAYS = (1.0, 2.0, 4.0)  # 429/5xx 指数退避;之后如实抛错
_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class EmbedError(SystemExit):
    """embedding 调用失败(网络/鉴权/协议),消息面向用户可读。"""


def _post_batch(client: httpx.Client, emb: EmbeddingConfig, key: str,
                texts: list[str]) -> list[list[float]]:
    url = emb.base_url.rstrip("/") + "/embeddings"
    payload = {"model": emb.model, "input": texts}
    headers = {"Authorization": f"Bearer {key}"}
    last_err: Exception | None = None
    for attempt, delay in enumerate((*_RETRY_DELAYS, None)):
        try:
            resp = client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            last_err = exc
            if delay is None:
                break
            time.sleep(delay)
            continue
        if resp.status_code == 429 or resp.status_code >= 500:
            last_err = EmbedError(f"embedding API {resp.status_code}: {resp.text[:200]}")
            if delay is None:
                break
            time.sleep(delay)
            continue
        if resp.status_code != 200:
            raise EmbedError(f"embedding API {resp.status_code}: {resp.text[:300]}")
        data = resp.json()["data"]
        # 供应商可能乱序返回,按 index 归位
        vectors: list[list[float]] = [[] for _ in texts]
        for item in data:
            vectors[item["index"]] = item["embedding"]
        for i, vec in enumerate(vectors):
            if len(vec) != emb.dim:
                raise EmbedError(
                    f"维度不符: 模型返回 {len(vec)} 维,config.dim={emb.dim}"
                    f"(第 {i} 条)。换过模型请 reindex --force 重建向量库"
                )
        return vectors
    raise EmbedError(f"embedding API 重试 {len(_RETRY_DELAYS)} 次后仍失败: {last_err}")


def embed_texts(emb: EmbeddingConfig, texts: list[str]) -> list[list[float]]:
    """批量向量化(内部按 BATCH_SIZE 分批,顺序与输入一致)。"""
    key = api_key()
    if not key:
        raise EmbedError(f"环境变量 {ENV_API_KEY} 未设置,无法调用 embedding API")
    out: list[list[float]] = []
    with httpx.Client(timeout=_TIMEOUT) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            out.extend(_post_batch(client, emb, key, texts[i:i + BATCH_SIZE]))
    return out


def probe_dim(base_url: str, model: str) -> int:
    """init 用:实调一次 API 探测向量维度(同时验证 key/网络/模型名可用)。"""
    key = api_key()
    if not key:
        raise EmbedError(f"环境变量 {ENV_API_KEY} 未设置,无法探测维度")
    probe = EmbeddingConfig(base_url=base_url, model=model, dim=-1)
    with httpx.Client(timeout=_TIMEOUT) as client:
        url = probe.base_url.rstrip("/") + "/embeddings"
        resp = client.post(url, json={"model": model, "input": ["dim probe"]},
                           headers={"Authorization": f"Bearer {key}"})
    if resp.status_code != 200:
        raise EmbedError(f"探测失败 {resp.status_code}: {resp.text[:300]}")
    return len(resp.json()["data"][0]["embedding"])
