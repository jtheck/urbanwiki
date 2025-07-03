// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById("map");
  const worldMap = new WorldMap(canvas);
  
  // Initial resize
  worldMap.resize();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    worldMap.resize();
  });
}); 