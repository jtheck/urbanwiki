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
  
  // Prevent map drag events when clicking on header
  const header = document.getElementById("header");
  const headerH3 = header.querySelector("h3");
  
  header.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  header.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Specifically prevent events on the h3 element
  headerH3.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });
  
  headerH3.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });
}); 