// Map functionality module
class WorldMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 0;
    this.height = 0;
    
    // Enable crisp lines
    this.ctx.imageSmoothingEnabled = false;
    
    // Map state
    this.state = {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      minScale: 1,    // Can't zoom out further than full canvas height
      maxScale: 8,    // Can't zoom in further
      isDragging: false,
      lastX: 0, lastY: 0
    };

    // Load SVG globe image
    this.globeImage = new Image();
    this.globeImage.onload = () => {
      this.redraw(); // Redraw once image is loaded
    };
    this.globeImage.onerror = () => {
      console.error('Failed to load globe image');
    };
    this.globeImage.src = 'globe.svg';

    this.setupEventListeners();
  }

  // Project lat/long to globe coords (equirectangular)
  project(lng, lat) {
    return [
      (lng + 180) * (this.globeImage.width / 360),
      (90 - lat) * (this.globeImage.height / 180)
    ];
  }

  // Draw SVG globe with horizontal wrapping
  drawMap() {
    if (!this.globeImage || !this.globeImage.complete) {
      // Image not loaded yet, skip drawing
      return;
    }

    // Calculate effective canvas height (viewport height minus header height)
    const effectiveHeight = this.height - 80; // Account for floating header
    const scaleToFitHeight = effectiveHeight / this.globeImage.height;
    const scaledGlobeWidth = this.globeImage.width * scaleToFitHeight * this.state.scale;
    const scaledGlobeHeight = this.globeImage.height * scaleToFitHeight * this.state.scale;
    const globeY = (this.height - scaledGlobeHeight) / 2;

    // Always draw wrapped copies for seamless horizontal panning
    const offsetX = this.state.offsetX % scaledGlobeWidth;
    const numCopies = Math.ceil(this.width / scaledGlobeWidth) + 2; // Extra copies for smooth wrapping
    
    for (let i = -1; i < numCopies; i++) {
      const copyOffsetX = i * scaledGlobeWidth;
      this.ctx.save();
      this.ctx.translate(copyOffsetX + offsetX, globeY + this.state.offsetY);
      this.ctx.scale(scaleToFitHeight * this.state.scale, scaleToFitHeight * this.state.scale);
      this.ctx.drawImage(this.globeImage, 0, 0);
      this.ctx.restore();
    }
  }

  // Draw marker with SVG-style rendering and wrapping
  drawMarker(lng, lat, label) {
    if (!this.globeImage || !this.globeImage.complete) {
      // Image not loaded yet, skip drawing
      return;
    }
    const effectiveHeight = this.height - 80; // Account for floating header
    const scaleToFitHeight = effectiveHeight / this.globeImage.height;
    const scaledGlobeWidth = this.globeImage.width * scaleToFitHeight * this.state.scale;
    const scaledGlobeHeight = this.globeImage.height * scaleToFitHeight * this.state.scale;
    const globeY = (this.height - scaledGlobeHeight) / 2;
    
    // Always draw wrapped markers for seamless horizontal panning
    const offsetX = this.state.offsetX % scaledGlobeWidth;
    const numCopies = Math.ceil(this.width / scaledGlobeWidth) + 2;
    
    for (let i = -1; i < numCopies; i++) {
      const copyOffsetX = i * scaledGlobeWidth;
      this.ctx.save();
      this.ctx.translate(copyOffsetX + offsetX, globeY + this.state.offsetY);
      this.ctx.scale(scaleToFitHeight * this.state.scale, scaleToFitHeight * this.state.scale);
      const [x, y] = this.project(lng, lat);
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2, 0, Math.PI * 2);
      this.ctx.fillStyle = "red";
      this.ctx.fill();
      this.ctx.strokeStyle = "#333";
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      this.ctx.fillStyle = "black";
      this.ctx.font = "12px Arial";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(label, x + 2, y);
      this.ctx.restore();
    }
  }

  // Main render
  redraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawMap();
    
    // Test multiple markers around the world (shifted left 15 degrees)
    this.drawMarker(16.8, -1.3, "Nairobi");
    this.drawMarker(-94.0, 40.7, "New York");
    this.drawMarker(119.7, 35.7, "Tokyo");
    this.drawMarker(-17.7, 48.9, "Paris");
    this.drawMarker(131.2, -33.9, "Sydney");
    this.drawMarker(-119.1, 19.4, "Mexico City");
    this.drawMarker(17.6, 55.8, "Moscow");
    this.drawMarker(-63.2, -22.9, "Rio de Janeiro");
  }

  // Resize canvas
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight; // Full viewport height since header floats above
    
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    // Re-enable crisp lines after resize
    this.ctx.imageSmoothingEnabled = false;
    
    this.redraw();
  }

  // Constrain vertical panning to prevent going beyond poles
  constrainVerticalPan() {
    const effectiveHeight = this.height - 80; // Account for floating header
    const scaleToFitHeight = effectiveHeight / this.globeImage.height;
    const scaledGlobeHeight = this.globeImage.height * scaleToFitHeight * this.state.scale;
    const globeY = (this.height - scaledGlobeHeight) / 2;

    // The allowed offsetY range ensures the globe cannot move off the top or bottom
    // When zoomed in, the globe is larger than the canvas, so offsetY can be negative
    // When zoomed out, the globe is centered and offsetY should be 0
    let minOffsetY, maxOffsetY;
    if (scaledGlobeHeight <= this.height) {
      // Globe fits within canvas, center it
      minOffsetY = maxOffsetY = 0;
    } else {
      // Globe is larger than canvas, allow panning but not beyond globe edges
      minOffsetY = this.height - (globeY + scaledGlobeHeight); // bottom edge at canvas bottom
      maxOffsetY = -globeY; // top edge at canvas top
    }
    this.state.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.state.offsetY));
  }

  // Handle horizontal wrapping - simplified since we're drawing multiple copies
  handleHorizontalWrapping() {
    // No need to constrain offsetX since we're drawing multiple copies
    // The wrapping is handled in the drawing functions
  }

  // Setup event listeners
  setupEventListeners() {
    // Cursor-centered zoom - listen on document to catch events over header
    this.handleWheel = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.1 : 0.9; // Zoom in/out

      // Calculate new scale with limits
      const newScale = Math.min(Math.max(this.state.scale * delta, this.state.minScale), this.state.maxScale);
      const scaleFactor = newScale / this.state.scale;

      // Adjust offset to zoom toward cursor
      this.state.offsetX = mouseX - (mouseX - this.state.offsetX) * scaleFactor;
      this.state.offsetY = mouseY - (mouseY - this.state.offsetY) * scaleFactor;
      this.state.scale = newScale;

      // Apply constraints
      this.constrainVerticalPan();
      this.handleHorizontalWrapping();

      this.redraw();
    };

    document.addEventListener("wheel", this.handleWheel, { passive: false });

    // Smooth panning
    this.canvas.addEventListener("mousedown", (e) => {
      this.state.isDragging = true;
      this.state.lastX = e.clientX;
      this.state.lastY = e.clientY;
      this.canvas.style.cursor = "grabbing";
    });

    // Global mouse up to handle when mouse leaves window
    const handleMouseUp = () => {
      if (this.state.isDragging) {
        this.state.isDragging = false;
        this.canvas.style.cursor = "grab";
      }
    };

    // Global mouse move to handle when mouse leaves canvas
    const handleMouseMove = (e) => {
      if (!this.state.isDragging) return;
      this.state.offsetX += e.clientX - this.state.lastX;
      this.state.offsetY += e.clientY - this.state.lastY;
      this.state.lastX = e.clientX;
      this.state.lastY = e.clientY;

      // Apply constraints
      this.constrainVerticalPan();
      this.handleHorizontalWrapping();

      this.redraw();
    };

    // Add global event listeners
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);

    // Store cleanup function
    this.cleanup = () => {
      document.removeEventListener("wheel", this.handleWheel);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }

  // Cleanup method to remove event listeners
  destroy() {
    if (this.cleanup) {
      this.cleanup();
    }
  }
} 