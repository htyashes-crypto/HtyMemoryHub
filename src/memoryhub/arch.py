"""架构图谱层:模块文件(index_12_architecture 组)解析、机器围栏校验、派生表同步。

权威 = md 文件的 frontmatter 结构化字段;modules/features/relations 等表是派生索引,
每次同步整组全量重建。细节层合规由本模块硬拦(plan-2 §4.2 围栏):用户只审架构层,
围栏保证 AI 写入的细节结构可信。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from .scanner import MemoryDoc

ARCH_GROUP = "index_12_architecture"
MODULE_PREFIX = "module_"
RELATION_TYPES = ("depends_on", "affects", "shares_state", "extends", "related")
EP_KINDS = ("base-class", "interface", "reflection-registry", "config-registry")
ALLOWED_FIELDS = {
    "name", "title", "summary", "layer", "approved", "key_assets",
    "features", "extension_points", "relations",
    "description", "type",  # 与普通记忆 frontmatter 兼容的通用字段
}


@dataclass
class ModuleDef:
    name: str
    title: str
    summary: str
    layer: str
    approved: str
    key_assets: list[str]
    features: list[dict] = field(default_factory=list)
    extension_points: list[dict] = field(default_factory=list)
    relations: list[dict] = field(default_factory=list)
    doc_name: str = ""


def is_module_doc(doc: MemoryDoc) -> bool:
    return doc.group == ARCH_GROUP and doc.name.startswith(MODULE_PREFIX)


def _err(errors: list[str], doc: str, msg: str) -> None:
    errors.append(f"[{doc}] {msg}")


def parse_module(doc: MemoryDoc, errors: list[str]) -> ModuleDef | None:
    """单文件解析 + 文件内围栏(R2/R3/R5/R8 的本地部分);违规记 errors 返回 None。"""
    fm = doc.frontmatter
    before = len(errors)
    for key in fm:
        if key not in ALLOWED_FIELDS:
            _err(errors, doc.name, f"R5 未知 frontmatter 字段: {key}")
    for req in ("name", "title", "summary", "layer"):
        if not str(fm.get(req) or "").strip():
            _err(errors, doc.name, f"R5 缺少必填字段: {req}")
    if not str(fm.get("approved") or "").strip():
        _err(errors, doc.name, "R3 缺少 approved 批准标记(新模块须经用户架构层批准)")
    features = fm.get("features") or []
    if not isinstance(features, list):
        _err(errors, doc.name, "R5 features 须为列表")
        features = []
    for f in features:
        if not isinstance(f, dict) or not str(f.get("id") or "").strip():
            _err(errors, doc.name, f"R5 feature 缺 id: {f!r:.60}")
    eps = fm.get("extension_points") or []
    if not isinstance(eps, list):
        _err(errors, doc.name, "R5 extension_points 须为列表")
        eps = []
    for ep in eps:
        if not isinstance(ep, dict):
            _err(errors, doc.name, "R8 extension_point 须为对象")
            continue
        if ep.get("kind") not in EP_KINDS:
            _err(errors, doc.name, f"R8 扩展点 {ep.get('id')} kind 非法: {ep.get('kind')}(可选 {'/'.join(EP_KINDS)})")
        if not str(ep.get("anchor") or "").strip():
            _err(errors, doc.name, f"R8 扩展点 {ep.get('id')} 缺 anchor(基类/接口/注册表符号)")
        impls = ep.get("implementations") or []
        if not isinstance(impls, list) or any(
            not str((i or {}).get("name") if isinstance(i, dict) else i or "").strip() for i in impls
        ):
            _err(errors, doc.name, f"R8 扩展点 {ep.get('id')} implementations 含空名")
    relations = fm.get("relations") or []
    if not isinstance(relations, list):
        _err(errors, doc.name, "R5 relations 须为列表")
        relations = []
    for r in relations:
        if not isinstance(r, dict):
            _err(errors, doc.name, "R2 relation 须为对象")
            continue
        if r.get("type") not in RELATION_TYPES:
            _err(errors, doc.name, f"R2 边 type 非法: {r.get('type')}(可选 {'/'.join(RELATION_TYPES)})")
        if not str(r.get("target") or "").strip():
            _err(errors, doc.name, "R1 边缺 target")
        if not str(r.get("reason") or "").strip():
            _err(errors, doc.name, f"R2 边 {r.get('type')}→{r.get('target')} 缺 reason(无理由的边禁止入库)")
    if len(errors) > before:
        return None
    return ModuleDef(
        name=str(fm["name"]).strip(),
        title=str(fm["title"]).strip(),
        summary=str(fm["summary"]).strip(),
        layer=str(fm["layer"]).strip(),
        approved=str(fm["approved"]).strip(),
        key_assets=[str(a) for a in (fm.get("key_assets") or [])],
        features=features,
        extension_points=eps,
        relations=relations,
        doc_name=doc.name,
    )


def validate_cross(defs: list[ModuleDef], doc_names: set[str], errors: list[str]) -> None:
    """跨文件围栏:R1 target 存在、R4 memory_refs 存在、R6 组内纯净、R8 anchor 跨模块唯一。"""
    module_names = {d.name for d in defs}
    feature_keys = {f"{d.name}#{f['id']}" for d in defs for f in d.features}
    anchors: dict[str, str] = {}
    for d in defs:
        for ep in d.extension_points:
            anchor = str(ep.get("anchor") or "")
            if anchor in anchors and anchors[anchor] != d.name:
                _err(errors, d.doc_name, f"R8 anchor '{anchor}' 已在模块 {anchors[anchor]} 声明,禁跨模块重复")
            anchors[anchor] = d.name
        for r in d.relations:
            target = str(r.get("target") or "")
            if target not in module_names and target not in feature_keys:
                _err(errors, d.doc_name, f"R1 边 target 不存在: {target}(可用模块名或 模块名#featureId)")
        for f in d.features:
            for ref in f.get("memory_refs") or []:
                if str(ref) not in doc_names:
                    _err(errors, d.doc_name, f"R4 feature {f['id']} 的 memory_refs 不存在: {ref}")
        for ep in d.extension_points:
            for impl in ep.get("implementations") or []:
                for ref in (impl.get("memory_refs") or []) if isinstance(impl, dict) else []:
                    if str(ref) not in doc_names:
                        _err(errors, d.doc_name, f"R4 扩展点 {ep.get('id')} 实现 memory_refs 不存在: {ref}")


def check_group_purity(docs: list[MemoryDoc], errors: list[str]) -> None:
    """R6:index_12 组内只允许模块文件与组封面;普通记忆禁带 relations 字段。"""
    for doc in docs:
        if doc.group == ARCH_GROUP:
            if not doc.name.startswith(MODULE_PREFIX) and not doc.name.startswith("index_"):
                _err(errors, doc.name, "R6 架构组内只允许 module_* 与 index_* 封面文件")
        elif "relations" in doc.frontmatter:
            _err(errors, doc.name, "R6 普通记忆禁带 relations 字段(类型化边只属架构模块文件)")


def collect(docs: list[MemoryDoc]) -> tuple[list[ModuleDef], list[str]]:
    """全量解析 + 全部围栏;返回 (合规模块定义, 违规清单)。"""
    errors: list[str] = []
    check_group_purity(docs, errors)
    defs = [m for d in docs if is_module_doc(d) if (m := parse_module(d, errors))]
    validate_cross(defs, {d.name for d in docs}, errors)
    return defs, errors


def sync_to_store(con, defs: list[ModuleDef]) -> None:
    """派生表全量重建(架构文件量级小,整体替换简单可靠、无残留)。"""
    con.execute("DELETE FROM modules")
    con.execute("DELETE FROM features")
    con.execute("DELETE FROM extension_points")
    con.execute("DELETE FROM relations")
    for d in defs:
        con.execute(
            "INSERT INTO modules(name,title,summary,layer,approved,key_assets,doc_name) VALUES(?,?,?,?,?,?,?)",
            (d.name, d.title, d.summary, d.layer, d.approved,
             json.dumps(d.key_assets, ensure_ascii=False), d.doc_name))
        for f in d.features:
            con.execute(
                "INSERT INTO features(module,fid,title,requirement,logic,memory_refs) VALUES(?,?,?,?,?,?)",
                (d.name, str(f["id"]), str(f.get("title") or ""), str(f.get("requirement") or ""),
                 str(f.get("logic") or ""), json.dumps(f.get("memory_refs") or [], ensure_ascii=False)))
        for ep in d.extension_points:
            impls = [i if isinstance(i, dict) else {"name": str(i)} for i in (ep.get("implementations") or [])]
            con.execute(
                "INSERT INTO extension_points(module,epid,title,kind,anchor,additive_note,implementations) "
                "VALUES(?,?,?,?,?,?,?)",
                (d.name, str(ep.get("id") or ""), str(ep.get("title") or ""), str(ep["kind"]),
                 str(ep["anchor"]), str(ep.get("additive_note") or ""),
                 json.dumps(impls, ensure_ascii=False)))
        for r in d.relations:
            con.execute(
                "INSERT INTO relations(src_module,src_feature,rtype,target,reason,evidence) VALUES(?,?,?,?,?,?)",
                (d.name, r.get("from_feature"), str(r["type"]), str(r["target"]), str(r["reason"]),
                 json.dumps(r.get("evidence") or [], ensure_ascii=False)))
