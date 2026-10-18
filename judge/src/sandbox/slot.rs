use crate::sandbox::cgroup::CgroupV2Slot;
use anyhow::{Context, Result};
use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tracing::{info, warn};

pub struct Slot {
    pub id: usize,
    pub core_id: usize,
    pub cgroup: CgroupV2Slot,
    pub tmpfs_dir: PathBuf,
    pub is_quarantined: bool,
}

impl Slot {
    pub fn new(id: usize, core_id: usize, cgroup_base: &Path, tmpfs_base: &Path) -> Result<Self> {
        let cgroup = CgroupV2Slot::new(id, cgroup_base)?;
        let tmpfs_dir = tmpfs_base.join(format!("slot-{}", id));
        fs::create_dir_all(&tmpfs_dir)
            .with_context(|| format!("Failed to create tmpfs dir: {:?}", tmpfs_dir))?;

        cgroup.initialize(Some(core_id))?;

        Ok(Self {
            id,
            core_id,
            cgroup,
            tmpfs_dir,
            is_quarantined: false,
        })
    }

    pub fn clean(&self) -> Result<()> {
        self.cgroup.reset()?;
        // Clean tmpfs directory
        if self.tmpfs_dir.exists() {
            for entry in fs::read_dir(&self.tmpfs_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    let _ = fs::remove_dir_all(&path);
                } else {
                    let _ = fs::remove_file(&path);
                }
            }
        }
        Ok(())
    }

    pub fn quarantine(&mut self, reason: &str) {
        warn!(slot_id = self.id, reason = reason, "Quarantining broken slot");
        self.is_quarantined = true;
        let _ = self.cgroup.kill();
    }
}

pub struct SlotPool {
    available: Arc<Mutex<VecDeque<Slot>>>,
    quarantined: Arc<Mutex<Vec<Slot>>>,
}

impl SlotPool {
    pub fn new(count: usize, cgroup_base: &Path, tmpfs_base: &Path) -> Result<Self> {
        let mut available = VecDeque::with_capacity(count);
        for id in 0..count {
            let slot = Slot::new(id, id, cgroup_base, tmpfs_base)?;
            available.push_back(slot);
        }

        info!(count = count, "Initialized judge slot pool with dedicated cgroups");
        Ok(Self {
            available: Arc::new(Mutex::new(available)),
            quarantined: Arc::new(Mutex::new(Vec::new())),
        })
    }

    pub fn acquire(&self) -> Option<Slot> {
        let mut pool = self.available.lock().unwrap();
        pool.pop_front()
    }

    pub fn release(&self, mut slot: Slot) {
        if slot.is_quarantined {
            let mut q = self.quarantined.lock().unwrap();
            q.push(slot);
        } else {
            if let Err(e) = slot.clean() {
                warn!(slot_id = slot.id, error = %e, "Failed to clean slot, quarantining");
                slot.quarantine("Cleanup failure");
                let mut q = self.quarantined.lock().unwrap();
                q.push(slot);
            } else {
                let mut pool = self.available.lock().unwrap();
                pool.push_back(slot);
            }
        }
    }
}
