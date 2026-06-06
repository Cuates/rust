#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Calling run from the library
    file_finder_rust_lib::run();
}
