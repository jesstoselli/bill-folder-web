// Keeps release builds from opening a console window on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    billfolder_desktop_lib::run()
}
