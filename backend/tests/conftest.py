import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from app.database import Base, get_db
from app.main import app
from app.models.email_verification import EmailVerification

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    def override_get_db():
        yield db
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]


def register_user(client, db, email="u@example.com", password="123456"):
    """测试辅助：向测试库写入一条有效的邮箱验证码并完成注册。

    真实发信需要 SMTP 配置，测试里改为直接注入验证码记录，再走标准
    /api/auth/register 流程（含验证码校验），保证覆盖注册验证逻辑。
    """
    from app.services.email_service import generate_code

    code = generate_code()
    db.add(EmailVerification(
        email=email, code=code, used=False,
        # naive UTC，与 email_service._utcnow() 及 SQLite 读出值保持一致
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    ))
    db.commit()
    return client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "code": code},
    )
