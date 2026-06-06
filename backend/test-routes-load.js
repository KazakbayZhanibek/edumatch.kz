try {
  const admissionRoutes = require('./admission-routes');
  console.log('✓ admission-routes loaded successfully');
  console.log('Routes:', admissionRoutes);
} catch (err) {
  console.error('✗ Error loading admission-routes:', err.message);
  console.error(err.stack);
}
