use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct CompilerProfile {
    pub language_id: &'static str,
    pub executable: &'static str,
    pub flags: &'static [&'static str],
    pub source_ext: &'static str,
    pub output_name: &'static str,
}

pub struct CompilerRegistry {
    profiles: HashMap<&'static str, CompilerProfile>,
}

impl CompilerRegistry {
    pub fn new() -> Self {
        let mut profiles = HashMap::new();

        profiles.insert(
            "cpp23-gcc",
            CompilerProfile {
                language_id: "cpp23-gcc",
                executable: "g++",
                flags: &[
                    "-std=c++23",
                    "-O2",
                    "-pipe",
                    "-static",
                    "-s",
                    "-DONLINE_JUDGE",
                    "-Wall",
                    "-Wextra",
                ],
                source_ext: "cpp",
                output_name: "solution",
            },
        );

        profiles.insert(
            "cpp23-clang",
            CompilerProfile {
                language_id: "cpp23-clang",
                executable: "clang++",
                flags: &[
                    "-std=c++23",
                    "-O2",
                    "-pipe",
                    "-static",
                    "-s",
                    "-DONLINE_JUDGE",
                    "-Wall",
                    "-Wextra",
                ],
                source_ext: "cpp",
                output_name: "solution",
            },
        );

        profiles.insert(
            "c23-gcc",
            CompilerProfile {
                language_id: "c23-gcc",
                executable: "gcc",
                flags: &[
                    "-std=c2x",
                    "-O2",
                    "-pipe",
                    "-static",
                    "-s",
                    "-DONLINE_JUDGE",
                    "-Wall",
                    "-Wextra",
                ],
                source_ext: "c",
                output_name: "solution",
            },
        );

        profiles.insert(
            "c23-clang",
            CompilerProfile {
                language_id: "c23-clang",
                executable: "clang",
                flags: &[
                    "-std=c2x",
                    "-O2",
                    "-pipe",
                    "-static",
                    "-s",
                    "-DONLINE_JUDGE",
                    "-Wall",
                    "-Wextra",
                ],
                source_ext: "c",
                output_name: "solution",
            },
        );

        Self { profiles }
    }

    pub fn get(&self, lang: &str) -> Option<&CompilerProfile> {
        self.profiles.get(lang).or_else(|| self.profiles.get("cpp23-gcc"))
    }
}
