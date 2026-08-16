from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_listener_rewards_each_successful_workflow_once():
    listener = (ROOT / "web" / "listener.js").read_text()

    assert 'addEventListener("execution_success"' in listener
    assert "prompt_id" in listener
    assert "rememberPrompt(promptId)" in listener
    assert 'source: "workflow_success"' in listener


def test_listener_has_no_partner_or_api_node_dependency():
    listener = (ROOT / "web" / "listener.js").read_text().lower()

    assert "api_node" not in listener
    assert "comfy_api_nodes" not in listener
    assert "nodes_partner" not in listener
    assert "gemini" not in listener
    assert "openai" not in listener


def test_readme_describes_local_first_happiness():
    readme = (ROOT / "README.md").read_text().lower()

    assert "every successful workflow" in readme
    assert "partner api" not in readme
    assert "premium api" not in readme
