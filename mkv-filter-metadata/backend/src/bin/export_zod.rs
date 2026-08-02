use mkv_filter_metadata_rust_lib::commands::*;
use mkv_filter_metadata_rust_lib::models::*;
use specta::Types;
use specta_zod::{BigIntExportBehavior, Zod};

fn main() {
    let mut builder = Types::default();
    builder.register_mut::<VideoPipelinePayload>();
    builder.register_mut::<EncoderCapabilities>();
    builder.register_mut::<FileStat>();
    builder.register_mut::<DirectoryStats>();
    builder.register_mut::<PipelineSummary>();

    let mut zod_str = Zod::default()
        .bigint(BigIntExportBehavior::Number)
        .export(&builder, &specta_serde::Format)
        .unwrap();

    // Workaround for specta-zod 0.0.3 alphabetically sorting types,
    // which causes a ReferenceError because DirectoryStats comes before FileStat.
    zod_str = zod_str.replace(
        "z.array(FileStatSchema)",
        "z.array(z.lazy(() => FileStatSchema))",
    );

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let out_path = std::path::PathBuf::from(manifest_dir).join("../frontend/src/lib/types.ts");
    std::fs::write(out_path, zod_str).unwrap();
}
