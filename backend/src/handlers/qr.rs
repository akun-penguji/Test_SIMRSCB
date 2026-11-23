// Generate QR code LOKAL sebagai data: URI (SVG). Menggantikan pemanggilan ke
// layanan pihak ketiga (api.qrserver.com) supaya identitas pasien/petugas tidak
// dikirim ke internet saat aplikasi dionlinekan.
use base64::Engine;

pub fn qr_data_uri(data: &str) -> String {
    match qrcode::QrCode::new(data.as_bytes()) {
        Ok(code) => {
            let svg = code
                .render::<qrcode::render::svg::Color>()
                .min_dimensions(80, 80)
                .quiet_zone(true)
                .build();
            let b64 = base64::engine::general_purpose::STANDARD.encode(svg.as_bytes());
            format!("data:image/svg+xml;base64,{}", b64)
        }
        Err(_) => String::new(),
    }
}
