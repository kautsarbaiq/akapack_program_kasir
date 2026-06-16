// Mencegah jendela konsol muncul di Windows pada build rilis.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    akapack_lib::run()
}
