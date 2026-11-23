use crate::auth::jwt::decode_jwt;
use crate::models::auth::Claims;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

pub struct AuthState {
    pub jwt_secret: String,
}

/// Extractor: ambil Claims dari Authorization header atau cookie `token`
pub struct AuthUser(pub Claims);

#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    crate::AppState: axum::extract::FromRef<S>,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = crate::AppState::from_ref(state as &S);
        let secret = &app_state.jwt_secret;

        // Hanya dari Authorization: Bearer <token>. Cookie-token fallback dihapus:
        // token disimpan di localStorage & dikirim via header oleh frontend, jadi
        // tak ada cookie yang auto-terkirim → menutup permukaan CSRF.
        let token = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(|s| s.to_string());

        match token {
            None => Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Token tidak ditemukan"})),
            )
                .into_response()),
            Some(t) => decode_jwt(&t, secret).map(AuthUser).map_err(|_| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error": "Token tidak valid atau expired"})),
                )
                    .into_response()
            }),
        }
    }
}
