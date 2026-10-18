use anyhow::Result;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

pub struct CompileCache {
    cache_dir: PathBuf,
}

impl CompileCache {
    pub fn new(cache_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&cache_dir);
        Self { cache_dir }
    }

    /// Compute SHA-256 content address
    pub fn compute_key(source: &str, compiler: &str, flags: &[&str]) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(source.as_bytes());
        hasher.update(compiler.as_bytes());
        for f in flags {
            hasher.update(f.as_bytes());
        }
        hex::encode(hasher.finalize())
    }

    /// Lookup cached binary
    pub fn get(&self, key: &str) -> Option<PathBuf> {
        let binary_path = self.cache_dir.join(key);
        if binary_path.exists() {
            debug!(key = key, "Content-addressed compile cache HIT");
            Some(binary_path)
        } else {
            None
        }
    }

    /// Store binary in cache
    pub fn put(&self, key: &str, binary_path: &Path) -> Result<PathBuf> {
        let cached_path = self.cache_dir.join(key);
        fs::copy(binary_path, &cached_path)?;
        debug!(key = key, "Stored binary in content-addressed compile cache");
        Ok(cached_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_key_deterministic() {
        let k1 = CompileCache::compute_key("int main(){}", "g++", &["-O2", "-std=c++23"]);
        let k2 = CompileCache::compute_key("int main(){}", "g++", &["-O2", "-std=c++23"]);
        let k3 = CompileCache::compute_key("int main(){}", "clang++", &["-O2", "-std=c++23"]);

        assert_eq!(k1, k2);
        assert_ne!(k1, k3);
        assert_eq!(k1.len(), 64);
    }
}
