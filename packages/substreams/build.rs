use anyhow::Result;
use substreams_ethereum::Abigen;

// Event bindings are generated from the real contract ABIs so topic0 hashes
// and indexed/non-indexed field decoding always match the deployed contracts.
const CONTRACTS: &[(&str, &str)] = &[
    ("ProfileRegistry", "profile_registry"),
    ("ActivityRegistry", "activity_registry"),
    ("TerritoryRegistry", "territory_registry"),
    ("SeasonManager", "season_manager"),
    ("AchievementRegistry", "achievement_registry"),
    ("ChallengeRegistry", "challenge_registry"),
    ("GroupRegistry", "group_registry"),
    ("SocialRegistry", "social_registry"),
];

fn main() -> Result<()> {
    std::fs::create_dir_all("src/abi")?;
    let mut mod_rs = String::new();
    for (name, module) in CONTRACTS {
        mod_rs.push_str(&format!("pub mod {module};\n"));
        let abi = format!("../contracts/src/abis/{name}.json");
        println!("cargo:rerun-if-changed={abi}");
        Abigen::new(*name, &abi)?
            .generate()?
            .write_to_file(format!("src/abi/{module}.rs"))?;
    }
    std::fs::write("src/abi/mod.rs", mod_rs)?;
    Ok(())
}
