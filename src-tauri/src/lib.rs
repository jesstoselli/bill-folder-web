use tauri::{Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// The app is a native window around the published web app: login, cookies
/// and updates work exactly as in the browser. Only the preview deployment is
/// live (it is what the API's CORS allows), so release builds open it. Debug
/// builds use the local `ng serve` instead.
const START_URL: &str = if cfg!(debug_assertions) {
    "http://localhost:4200"
} else {
    "https://preview.billfolder.app"
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let start: Url = START_URL.parse().expect("START_URL is a valid URL");
            let handle = app.handle().clone();
            let app_origin = start.origin();

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start))
                .title("BillFolder")
                .inner_size(1280.0, 820.0)
                .min_inner_size(420.0, 600.0)
                // Anything outside the app (a bank site, a help page) opens in
                // the default browser instead of replacing the app's page.
                .on_navigation(move |url| {
                    if url.origin() == app_origin {
                        return true;
                    }
                    if matches!(url.scheme(), "http" | "https" | "mailto") {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running BillFolder");
}
