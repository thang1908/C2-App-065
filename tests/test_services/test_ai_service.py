from src.services.ai_service import _chunk_nodes_for_ai, _compact_node_text


def test_chunk_nodes_keeps_every_node_without_keyword_filtering():
    nodes = {f"p_{index}": f"Nội dung mẫu cũ không có keyword {index}" for index in range(260)}

    chunks = _chunk_nodes_for_ai({node_id: _compact_node_text(text) for node_id, text in nodes.items()})
    flattened_ids = [node_id for chunk in chunks for node_id in chunk]

    assert flattened_ids == list(nodes)
