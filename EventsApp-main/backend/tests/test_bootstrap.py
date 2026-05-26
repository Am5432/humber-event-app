from fastapi.testclient import TestClient

from main import app


def test_health_endpoint_reports_healthy_status() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "Humber Event Hub",
    }
