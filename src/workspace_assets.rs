//! Native Workspace resources shipped with Projects Web.
//! Consumers use these exact bytes; they do not maintain a copied bundle.

/// Console-compatible native module using the Host-provided React runtime.
pub const MODULE: &str = include_str!("workspace/workspace.js");
/// Scoped styles accompanying the native module.
pub const STYLES: &str = include_str!("workspace/workspace.css");
