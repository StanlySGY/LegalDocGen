from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base application exception"""
    def __init__(self, message: str, status_code: int = 400, detail: str = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        super().__init__(self.message)


class ValidationError(AppException):
    """Validation error"""
    def __init__(self, message: str):
        super().__init__(message, status_code=422)


class NotFoundError(AppException):
    """Resource not found"""
    def __init__(self, message: str):
        super().__init__(message, status_code=404)


class UnauthorizedError(AppException):
    """Unauthorized access"""
    def __init__(self, message: str = "未授权"):
        super().__init__(message, status_code=401)


class ForbiddenError(AppException):
    """Forbidden access"""
    def __init__(self, message: str = "禁止访问"):
        super().__init__(message, status_code=403)


class InternalServerError(AppException):
    """Internal server error"""
    def __init__(self, message: str = "服务器内部错误"):
        super().__init__(message, status_code=500)


async def app_exception_handler(request: Request, exc: AppException):
    logger.error(f"AppException: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"ValidationError: {exc}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "请求参数验证失败"},
    )


async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "服务器内部错误"},
    )
