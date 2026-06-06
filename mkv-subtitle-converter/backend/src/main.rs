// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Hand over application bootstrap execution to the isolated lib container
    backend_lib::run();
}
