// Entry point bersama desktop & mobile (Tauri v2).
// `mobile_entry_point` dipanggil otomatis di Android/iOS.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error saat menjalankan aplikasi AKAPACK");
}
