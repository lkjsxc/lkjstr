//! Deterministic public read and retention policy. All observations are session-local.
pub mod features;
pub mod keep_policy;
pub mod link;
pub mod plan_policy;
mod rng;

use features::{Features, Route};
use link::Link;
use plan_policy::Plan;

pub(crate) struct Optimizer {
    pub link: Link,
    pub interaction: features::Interaction,
    pub hidden: bool,
    pub save_data: bool,
    pub hinted_at: u64,
    pub second: Option<u64>,
    pub enabled: bool,
}

impl Default for Optimizer {
    fn default() -> Self {
        Self {
            link: Link::default(),
            interaction: features::Interaction::default(),
            hidden: false,
            save_data: false,
            hinted_at: 0,
            second: None,
            enabled: true,
        }
    }
}

impl Optimizer {
    pub fn ready(&self) -> bool {
        self.enabled && self.link.state().samples >= 4
    }

    pub fn decide_plan(&self, features: Features, routes: &[Route]) -> Plan {
        plan_policy::decide(features, self.link.state(), routes, self.ready())
    }
}

#[cfg(test)]
mod fixtures_test;
#[cfg(test)]
mod replay_test;
