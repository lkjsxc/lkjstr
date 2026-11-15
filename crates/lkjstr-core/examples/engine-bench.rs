//! Deterministic index/row benchmark; fixtures are not network-verification data.
fn main() {
    let start = std::time::Instant::now();
    let result = lkjstr_core::engine::bench::run(|| start.elapsed().as_secs_f64() * 1000.0);
    println!("{result}");
}
