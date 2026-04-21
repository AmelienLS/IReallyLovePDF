#[tauri::command]
pub async fn open_pdf(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_pdf(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let tmp = format!("{}.tmp", path);
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}
