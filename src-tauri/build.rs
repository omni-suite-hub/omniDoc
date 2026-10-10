fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-changed=src/macos_defaults.m");
        cc::Build::new()
            .file("src/macos_defaults.m")
            .flag("-fmodules")
            .flag("-fcxx-modules")
            .compile("macos_defaults");

        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=UniformTypeIdentifiers");
    }

    tauri_build::build()
}
