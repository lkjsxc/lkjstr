// A process scan cannot reserve a shared Cargo target between coordinated proof steps.
// Shipping never deletes build artifacts; an explicitly owned maintenance task must do that.
process.stdout.write('debug cleanup deferred: shared build artifacts require separate coordinated maintenance\n');
