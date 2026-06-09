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

#[tauri::command]
fn install_apk(_path: String) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, launch_appimage, install_apk])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
