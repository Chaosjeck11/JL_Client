// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn launch_appimage(path: String) -> Result<(), String> {
    use std::env;
    use std::fs;

    let log_path = format!("{}/jl-update.log", env::temp_dir().display());

    // chmod +x
    std::process::Command::new("chmod")
        .args(["+x", &path])
        .status()
        .map_err(|e| e.to_string())?;

    // Write wrapper script to /tmp
    let home = env::var("HOME").unwrap_or_default();
    let install_path = format!("{}/.local/bin/jl-manager.AppImage", home);

    let script = format!(
        "#!/bin/bash\nsleep 1\nmv '{}' '{}'\nbash -c \"'{}' &\"\n",
        path, install_path, install_path
    );
    let script_path = "/tmp/jl-update.sh";
    fs::write(script_path, &script)
        .map_err(|e| format!("Script write failed: {}", e))?;
    std::process::Command::new("chmod")
        .args(["+x", script_path])
        .status()
        .map_err(|e| e.to_string())?;

    // Launch script detached, log output
    std::process::Command::new("bash")
        .args([script_path])
        .stdout(fs::File::create(&log_path).unwrap())
        .stderr(fs::File::create(&log_path).unwrap())
        .spawn()
        .map_err(|e| e.to_string())?;

    std::process::exit(0);
}

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    received: u64,
    total: u64,
}

#[tauri::command]
async fn download_file(
    app: tauri::AppHandle<impl tauri::Runtime>,
    url: String,
    filename: String,
    headers: Vec<(String, String)>,
) -> Result<String, String> {
    use futures_util::StreamExt;
    use std::io::Write;
    use tauri::{Emitter, Manager};

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Download-Verzeichnis nicht gefunden: {}", e))?;
    let file_path = download_dir.join(&filename);

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP-Client-Fehler: {}", e))?;

    let mut req = client.get(&url);
    for (key, value) in &headers {
        req = req.header(key.as_str(), value.as_str());
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("Verbindungsfehler: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server antwortete mit HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);

    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Datei konnte nicht erstellt werden: {}", e))?;

    let mut received: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Lesefehler: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Schreibfehler: {}", e))?;
        received += chunk.len() as u64;
        let _ = app.emit("download-progress", DownloadProgress { received, total });
    }

    Ok(file_path.to_string_lossy().to_string())
}

fn init_install_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("install")
        .setup(|_app, api| {
            #[cfg(target_os = "android")]
            api.register_android_plugin("com.ben.jl_manager", "InstallPlugin")?;
            let _ = api;
            Ok(())
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(init_install_plugin())
        .invoke_handler(tauri::generate_handler![greet, launch_appimage, download_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
