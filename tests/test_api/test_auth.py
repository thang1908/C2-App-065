import pytest


@pytest.mark.asyncio
async def test_register_returns_dev_verification_link(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher-register@example.com",
            "password": "password123",
            "full_name": "Teacher Register",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert "Please verify your email" in data["message"]
    assert data["verification_url"].startswith("http://test/?verify_token=")


@pytest.mark.asyncio
async def test_login_rejects_unverified_user(client):
    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher-unverified@example.com",
            "password": "password123",
            "full_name": "Teacher Unverified",
        },
    )
    assert register_response.status_code == 201

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "teacher-unverified@example.com", "password": "password123"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Please verify your email before logging in"


@pytest.mark.asyncio
async def test_verify_email_then_login(client):
    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher-verify@example.com",
            "password": "password123",
            "full_name": "Teacher Verify",
        },
    )
    verification_url = register_response.json()["verification_url"]
    token = verification_url.split("verify_token=", 1)[1]

    verify_response = await client.get("/api/v1/auth/verify-email", params={"token": token})
    assert verify_response.status_code == 200

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "teacher-verify@example.com", "password": "password123"},
    )

    assert login_response.status_code == 200
    data = login_response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "teacher-verify@example.com"
    assert data["user"]["is_email_verified"] is True


@pytest.mark.asyncio
async def test_me_returns_current_user(client):
    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher-me@example.com",
            "password": "password123",
            "full_name": "Teacher Me",
        },
    )
    verification_url = register_response.json()["verification_url"]
    token = verification_url.split("verify_token=", 1)[1]
    await client.get("/api/v1/auth/verify-email", params={"token": token})

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "teacher-me@example.com", "password": "password123"},
    )
    access_token = login_response.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "teacher-me@example.com"
    assert data["is_email_verified"] is True
