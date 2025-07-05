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
      maxScale: 51,    // Can't zoom in further
      isDragging: false,
      lastX: 0, lastY: 0,
      velocityX: 0,
      velocityY: 0,
      lastTime: 0,
      isMomentumActive: false
    };

    // SVG layers
    this.svgLayers = {
      continents: null,
      icons: {
        ocean: null,
        mountain: null,
        desert: null,
        tree: null,
        ice: null,
        city: null,
        space: null
      }
    };
    
    // Load SVG
    this.loadSVGLayers();

    this.setupEventListeners();

    this.testDots = [];
    this.forestDots = [];
    this.cityDots = [];
    this.mountainDots = [];
    this.iceDots = [];
    this.desertDots = [];
    this.spaceDots = [];
    this.oceanDots = [];
  }

    // Load and parse SVG
  async loadSVGLayers() {
    try {
      const response = await fetch('globe.svg');
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      
      // Find the main continent path
      const continentLayer = svgDoc.querySelector('path[id="path1"]');
      if (continentLayer) {
        this.svgLayers.continents = continentLayer;
      }

      // Load SVG icons from the Icons layer
      const allGroupsForIcons = svgDoc.getElementsByTagName('g');
      let iconsLayer = null;
      for (let i = 0; i < allGroupsForIcons.length; i++) {
        if (allGroupsForIcons[i].getAttribute('inkscape:label') === 'Icons') {
          iconsLayer = allGroupsForIcons[i];
          break;
        }
      }
      
      if (iconsLayer) {
        // Find all icon paths and map them by their label
        const iconPaths = iconsLayer.querySelectorAll('path');
        for (const path of iconPaths) {
          const label = path.getAttribute('inkscape:label') || path.id;
          if (label && label.startsWith('icon_')) {
            const iconType = label.replace('icon_', '');
            this.svgLayers.icons[iconType] = path;
            
            // Pre-compute Path2D and center for better performance
            const pathData = path.getAttribute('d');
            if (pathData) {
              const pathCoords = this.parseSVGPath(pathData);
              if (pathCoords.length > 0) {
                const minX = Math.min(...pathCoords.map(p => p.x));
                const maxX = Math.max(...pathCoords.map(p => p.x));
                const minY = Math.min(...pathCoords.map(p => p.y));
                const maxY = Math.max(...pathCoords.map(p => p.y));
                
                this.svgLayers.icons[iconType + '_path'] = new Path2D(pathData);
                this.svgLayers.icons[iconType + '_center'] = {
                  x: (minX + maxX) / 2,
                  y: (minY + maxY) / 2
                };
              }
            }
          }
        }
      }

      // --- DYNAMIC MULTI-LAYER PATH LOGIC ---
      // Define layers to process with their colors and individual dot counts
      const layersToProcess = [
        { label: 'Forest', color: 'green', dotsArray: 'forestDots', maxDots: 200 }, // 2x more trees!
        { label: 'City', color: 'yellow', dotsArray: 'cityDots', maxDots: 60 }, // 2x more cities
        { label: 'Mountain', color: 'brown', dotsArray: 'mountainDots', maxDots: 120 }, // 2x more mountains
        { label: 'Ice', color: 'cyan', dotsArray: 'iceDots', maxDots: 40 }, // Reduced ice
        { label: 'Desert', color: 'orange', dotsArray: 'desertDots', maxDots: 70 }, // Reduced deserts
        { label: 'Space', color: 'purple', dotsArray: 'spaceDots', maxDots: 50 }, // 2x more space stations
        { label: 'Ocean', color: 'blue', dotsArray: 'oceanDots', maxDots: 90 } // Increased ocean features
      ];
      
      for (const layerConfig of layersToProcess) {
        let layer = null;
        const gElements = svgDoc.getElementsByTagName('g');
        
        // First try to find the layer directly
        for (let i = 0; i < gElements.length; i++) {
          if (gElements[i].getAttribute('inkscape:label') === layerConfig.label) {
            layer = gElements[i];
            break;
          }
        }
        
        // If not found directly, look for it under the Terrains group
        if (!layer) {
          let terrainsGroup = null;
          for (let i = 0; i < gElements.length; i++) {
            if (gElements[i].getAttribute('inkscape:label') === 'Terrains') {
              terrainsGroup = gElements[i];
              break;
            }
          }
          
          if (terrainsGroup) {
            const terrainsChildren = terrainsGroup.getElementsByTagName('g');
            console.log(`Found Terrains group with ${terrainsChildren.length} children`);
            for (let i = 0; i < terrainsChildren.length; i++) {
              const childLabel = terrainsChildren[i].getAttribute('inkscape:label');
              console.log(`  Child ${i}: ${childLabel}`);
              if (childLabel === layerConfig.label) {
                layer = terrainsChildren[i];
                console.log(`Found ${layerConfig.label} in Terrains group`);
                break;
              }
            }
          }
        }
        
        if (!layer) {
          console.log(`Could not find layer: ${layerConfig.label}`);
          continue;
        }
        
        // Find ALL paths inside this layer
        const layerPaths = layer.querySelectorAll('path');
        if (layerPaths.length === 0) {
          continue;
        }
        

        
        // Get SVG width/height
        let svgWidth = 352, svgHeight = 178;
        if (svgDoc.documentElement.hasAttribute('width')) {
          svgWidth = parseFloat(svgDoc.documentElement.getAttribute('width'));
        }
        if (svgDoc.documentElement.hasAttribute('height')) {
          svgHeight = parseFloat(svgDoc.documentElement.getAttribute('height'));
        }
        
        // Create an offscreen canvas matching SVG size for isPointInPath
        const offCanvas = document.createElement('canvas');
        offCanvas.width = svgWidth;
        offCanvas.height = svgHeight;
        const offCtx = offCanvas.getContext('2d');
        
        // Generate dots for each path in this layer
        this[layerConfig.dotsArray] = [];
        const maxTotalDots = layerConfig.maxDots || 50; // Use individual dot counts
        
        // First pass: calculate total area and determine dots per path based on size
        const pathAreas = [];
        let totalArea = 0;
        
        for (let pathIndex = 0; pathIndex < layerPaths.length; pathIndex++) {
          const layerPath = layerPaths[pathIndex];
          const d = layerPath.getAttribute('d');
          if (!d) {
            pathAreas.push(0);
            continue;
          }
          
          // Use Path2D to represent the path
          const path2d = new Path2D(d);
          
          // Get bounding box from the path element
          let bbox = layerPath.getBBox ? layerPath.getBBox() : null;
          
          // If bbox is zero-sized, use SVG full size
          if (!bbox || bbox.width === 0 || bbox.height === 0) {
            bbox = { x: 0, y: 0, width: svgWidth, height: svgHeight };
          }
          
          // Calculate actual path area by sampling points
          let pathArea = 0;
          const sampleSize = 1000; // Number of sample points
          for (let i = 0; i < sampleSize; i++) {
            const px = bbox.x + Math.random() * bbox.width;
            const py = bbox.y + Math.random() * bbox.height;
            if (offCtx.isPointInPath(path2d, px, py)) {
              pathArea++;
            }
          }
          // Convert to percentage of bounding box area
          const areaPercentage = pathArea / sampleSize;
          const area = bbox.width * bbox.height * areaPercentage;
          
          pathAreas.push(area);
          totalArea += area;
        }
        
        // Second pass: generate dots based on area proportion
        for (let pathIndex = 0; pathIndex < layerPaths.length; pathIndex++) {
          const layerPath = layerPaths[pathIndex];
          const d = layerPath.getAttribute('d');
          if (!d) {
            continue;
          }
          
          // Use Path2D to represent the path
          const path2d = new Path2D(d);
          
          // Get bounding box from the path element
          let bbox = layerPath.getBBox ? layerPath.getBBox() : null;
          
          // If bbox is zero-sized, use SVG full size
          if (!bbox || bbox.width === 0 || bbox.height === 0) {
            bbox = { x: 0, y: 0, width: svgWidth, height: svgHeight };
          }
          
          // Calculate dots based on area proportion
          const area = pathAreas[pathIndex];
          const areaProportion = totalArea > 0 ? area / totalArea : 1 / layerPaths.length;
          const dotsForThisPath = Math.max(1, Math.floor(maxTotalDots * areaProportion));
          
          // Generate dots inside this path
          let pathDots = 0;
          let attempts = 0;
          while (pathDots < dotsForThisPath && attempts < 5000) {
            const px = bbox.x + Math.random() * bbox.width;
            const py = bbox.y + Math.random() * bbox.height;
            if (offCtx.isPointInPath(path2d, px, py)) {
              this[layerConfig.dotsArray].push({ x: px, y: py, color: layerConfig.color });
              pathDots++;
            }
            attempts++;
          }
        }

      }
      // --- END DYNAMIC MULTI-LAYER PATH LOGIC ---
      
      // PURGE ALL LAYERS EXCEPT CONTINENTS AND ICONS BEFORE RENDERING
      // Remove all group elements except the one containing the continents path and the Icons layer
      const allGroups = svgDoc.querySelectorAll('g');
      for (const group of allGroups) {
        const label = group.getAttribute('inkscape:label');
        // Keep the group that contains the continents path (path1) OR the Icons layer
        const hasContinentsPath = group.querySelector('path[id="path1"]');
        const isIconsLayer = label === 'Icons';
        const isContinentsLayer = label === 'Continents';
        if (!hasContinentsPath && !isIconsLayer && !isContinentsLayer) {
          group.remove();
        }
      }
      
      // Also remove any other elements that aren't the continents path or icon paths
      const allPaths = svgDoc.querySelectorAll('path');
      for (const path of allPaths) {
        if (path.id !== 'path1' && !path.id.startsWith('icon_')) {
          path.remove();
        }
      }
      
      // Create the purified SVG image with only continents
      const fullSvg = svgDoc.documentElement.outerHTML;
      const blob = new Blob([fullSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      // Create a canvas element to render the SVG
      this.globeImage = new Image();
      this.globeImage.onload = () => {
        this.redraw();
      };
      this.globeImage.onerror = () => {
        console.error('Failed to load globe image');
      };
      this.globeImage.src = url;
      
    } catch (error) {
      console.error('Failed to load SVG:', error);
      this.testDots = [];
    }
  }

  // Project longitude/latitude to x,y coordinates
  project(lng, lat) {
    const x = (lng + 180) * (this.globeImage.width / 360);
    const y = (90 - lat) * (this.globeImage.height / 180);
    return [x, y];
  }

  // Draw mini icons for different terrain types
  drawTerrainIcon(x, y, terrainType) {
    const size = 3; // Base size for icons
    
    switch(terrainType) {
      case 'Forest':
        const treePath = this.svgLayers.icons.tree_path;
        const treeCenter = this.svgLayers.icons.tree_center;
        if (treePath && treeCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#228B22';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-treeCenter.x, -treeCenter.y);
          this.ctx.stroke(treePath);
          this.ctx.restore();
        }
        break;
        
      case 'City':
        const cityPath = this.svgLayers.icons.city_path;
        const cityCenter = this.svgLayers.icons.city_center;
        if (cityPath && cityCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#8B0000';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-cityCenter.x, -cityCenter.y);
          this.ctx.stroke(cityPath);
          this.ctx.restore();
        }
        break;
        
      case 'Mountain':
        const mountainPath = this.svgLayers.icons.mountain_path;
        const mountainCenter = this.svgLayers.icons.mountain_center;
        if (mountainPath && mountainCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#8B4513';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-mountainCenter.x, -mountainCenter.y);
          this.ctx.stroke(mountainPath);
          this.ctx.restore();
        }
        break;
        
      case 'Ice':
        const icePath = this.svgLayers.icons.ice_path;
        const iceCenter = this.svgLayers.icons.ice_center;
        if (icePath && iceCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#87CEEB';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-iceCenter.x, -iceCenter.y);
          this.ctx.stroke(icePath);
          this.ctx.restore();
        }
        break;
        
      case 'Desert':
        const desertPath = this.svgLayers.icons.desert_path;
        const desertCenter = this.svgLayers.icons.desert_center;
        if (desertPath && desertCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#DAA520';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-desertCenter.x, -desertCenter.y);
          this.ctx.stroke(desertPath);
          this.ctx.restore();
        }
        break;
        
      case 'Ocean':
        const oceanPath = this.svgLayers.icons.ocean_path;
        const oceanCenter = this.svgLayers.icons.ocean_center;
        if (oceanPath && oceanCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#0066CC';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-oceanCenter.x, -oceanCenter.y);
          this.ctx.stroke(oceanPath);
          this.ctx.restore();
        }
        break;
        
      case 'Space':
        const spacePath = this.svgLayers.icons.space_path;
        const spaceCenter = this.svgLayers.icons.space_center;
        if (spacePath && spaceCenter) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.scale(size / 15, size / 15);
          this.ctx.strokeStyle = '#9370DB';
          this.ctx.lineWidth = 1.5;
          this.ctx.translate(-spaceCenter.x, -spaceCenter.y);
          this.ctx.stroke(spacePath);
          this.ctx.restore();
        }
        break;
        
      default:
        // Fallback to circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }
  }

  // Parse SVG path data to extract coordinates
  parseSVGPath(pathData) {
    const coordinates = [];
    let currentX = 0;
    let currentY = 0;
    
    // Split the path into commands and coordinates
    const commands = pathData.match(/[mlhvcsqtazMLHVCSQTAZ][^mlhvcsqtazMLHVCSQTAZ]*/g) || [];
    
    for (const command of commands) {
      const cmd = command[0];
      const coords = command.slice(1).trim().split(/[\s,]+/).filter(s => s.length > 0);
      
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 < coords.length) {
          let x = parseFloat(coords[i]);
          let y = parseFloat(coords[i + 1]);
          
          // Handle relative vs absolute coordinates
          if (cmd === cmd.toLowerCase()) {
            // Relative coordinates
            x += currentX;
            y += currentY;
          }
          
          // Update current position
          currentX = x;
          currentY = y;
          
          // Add to coordinates array
          coordinates.push({ x, y });
        }
      }
    }
    
    return coordinates;
  }

  // Draw the map
  drawMap() {
    if (!this.globeImage || !this.globeImage.complete) {
      return;
    }

    const effectiveHeight = this.height - 80;
    const scaleToFitHeight = effectiveHeight / this.globeImage.height;
    const scaledGlobeWidth = this.globeImage.width * scaleToFitHeight * this.state.scale;
    const scaledGlobeHeight = this.globeImage.height * scaleToFitHeight * this.state.scale;
    const globeY = (this.height - scaledGlobeHeight) / 2;
    const offsetX = this.state.offsetX % scaledGlobeWidth;
    const numCopies = Math.ceil(this.width / scaledGlobeWidth) + 2;

    // Pre-compute terrain dots array and mapping for better performance
    const allDots = [...(this.spaceDots || []), ...(this.oceanDots || []), ...(this.iceDots || []), ...(this.desertDots || []), ...(this.mountainDots || []), ...(this.forestDots || []), ...(this.cityDots || [])];
    const terrainTypeMap = {
      'green': 'Forest',
      'yellow': 'City', 
      'brown': 'Mountain',
      'cyan': 'Ice',
      'orange': 'Desert',
      'purple': 'Space',
      'blue': 'Ocean'
    };

    // Draw multiple copies for seamless horizontal panning
    for (let i = -1; i < numCopies; i++) {
      const copyOffsetX = i * scaledGlobeWidth;
      this.ctx.save();
      this.ctx.translate(copyOffsetX + offsetX, globeY + this.state.offsetY);
      this.ctx.scale(scaleToFitHeight * this.state.scale, scaleToFitHeight * this.state.scale);
      // Draw the full SVG image
      this.ctx.drawImage(this.globeImage, 0, 0);
      // Draw terrain icons from all layers (bottom to top: space, ocean, ice, desert, mountain, forest, city)

      if (allDots.length > 0) {
        this.ctx.save();
        
        // Cache common canvas properties for better performance
        this.ctx.strokeStyle = "#333";
        this.ctx.lineWidth = 0.5;
        
        for (const dot of allDots) {
          this.ctx.fillStyle = dot.color || "red";
          // Determine terrain type from color
          const terrainType = terrainTypeMap[dot.color] || 'Forest';
          this.drawTerrainIcon(dot.x, dot.y, terrainType);
        }
        this.ctx.restore();
      }
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
    if (!this.globeImage || !this.globeImage.height) {
      return;
    }
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

  // Start momentum animation
  startMomentum() {
    if (!this.state.isMomentumActive) return;
    
    const friction = 0.95; // Deceleration factor
    const minVelocity = 0.01; // Minimum velocity before stopping
    
    // Apply velocity to position
    this.state.offsetX += this.state.velocityX * 16; // 16ms = ~60fps
    this.state.offsetY += this.state.velocityY * 16;
    
    // Apply friction
    this.state.velocityX *= friction;
    this.state.velocityY *= friction;
    
    // Apply constraints
    this.constrainVerticalPan();
    this.handleHorizontalWrapping();
    
    // Redraw
    this.redraw();
    
    // Continue momentum or stop
    if (Math.abs(this.state.velocityX) > minVelocity || Math.abs(this.state.velocityY) > minVelocity) {
      requestAnimationFrame(() => this.startMomentum());
    } else {
      this.state.isMomentumActive = false;
      this.state.velocityX = 0;
      this.state.velocityY = 0;
    }
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

      // Calculate the current globe position and scale
      const effectiveHeight = this.height - 80;
      const scaleToFitHeight = effectiveHeight / this.globeImage.height;
      const scaledGlobeWidth = this.globeImage.width * scaleToFitHeight * this.state.scale;
      const scaledGlobeHeight = this.globeImage.height * scaleToFitHeight * this.state.scale;
      const globeY = (this.height - scaledGlobeHeight) / 2;

      // Convert mouse position to world coordinates (before the current transform)
      const worldMouseX = (mouseX - this.state.offsetX) / (scaleToFitHeight * this.state.scale);
      const worldMouseY = (mouseY - globeY - this.state.offsetY) / (scaleToFitHeight * this.state.scale);

      // Calculate new offsets to keep the world point under the mouse
      const newScaleToFitHeight = effectiveHeight / this.globeImage.height;
      const newScaledGlobeHeight = this.globeImage.height * newScaleToFitHeight * newScale;
      const newGlobeY = (this.height - newScaledGlobeHeight) / 2;

      this.state.offsetX = mouseX - worldMouseX * (newScaleToFitHeight * newScale);
      this.state.offsetY = mouseY - newGlobeY - worldMouseY * (newScaleToFitHeight * newScale);
      this.state.scale = newScale;

      // Apply constraints
      this.constrainVerticalPan();
      this.handleHorizontalWrapping();

      this.redraw();
    };

    document.addEventListener("wheel", this.handleWheel, { passive: false });

    // Smooth panning - Mouse events
    this.canvas.addEventListener("mousedown", (e) => {
      // Stop any active momentum
      this.state.isMomentumActive = false;
      this.state.velocityX = 0;
      this.state.velocityY = 0;
      
      this.state.isDragging = true;
      this.state.lastX = e.clientX;
      this.state.lastY = e.clientY;
      this.state.lastTime = Date.now();
      this.canvas.style.cursor = "grabbing";
    });

    // Touch events for mobile
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault(); // Prevent default touch behaviors
      if (e.touches.length === 1) {
        // Stop any active momentum
        this.state.isMomentumActive = false;
        this.state.velocityX = 0;
        this.state.velocityY = 0;
        
        this.state.isDragging = true;
        this.state.lastX = e.touches[0].clientX;
        this.state.lastY = e.touches[0].clientY;
        this.state.lastTime = Date.now();
      }
    }, { passive: false });

    // Global mouse up to handle when mouse leaves window
    const handleMouseUp = () => {
      if (this.state.isDragging) {
        this.state.isDragging = false;
        this.canvas.style.cursor = "grab";
        
        // Start momentum if velocity is significant
        if (Math.abs(this.state.velocityX) > 0.1 || Math.abs(this.state.velocityY) > 0.1) {
          this.state.isMomentumActive = true;
          this.startMomentum();
        }
      }
    };

    // Global touch end to handle when touch ends
    const handleTouchEnd = () => {
      if (this.state.isDragging) {
        this.state.isDragging = false;
        
        // Start momentum if velocity is significant
        if (Math.abs(this.state.velocityX) > 0.1 || Math.abs(this.state.velocityY) > 0.1) {
          this.state.isMomentumActive = true;
          this.startMomentum();
        }
      }
    };

    // Global mouse move to handle when mouse leaves canvas
    const handleMouseMove = (e) => {
      if (!this.state.isDragging) return;
      
      const currentTime = Date.now();
      const deltaTime = currentTime - this.state.lastTime;
      
      if (deltaTime > 0) {
        // Calculate velocity (pixels per millisecond)
        this.state.velocityX = (e.clientX - this.state.lastX) / deltaTime;
        this.state.velocityY = (e.clientY - this.state.lastY) / deltaTime;
      }
      
      this.state.offsetX += e.clientX - this.state.lastX;
      this.state.offsetY += e.clientY - this.state.lastY;
      this.state.lastX = e.clientX;
      this.state.lastY = e.clientY;
      this.state.lastTime = currentTime;

      // Apply constraints
      this.constrainVerticalPan();
      this.handleHorizontalWrapping();

      this.redraw();
    };

    // Global touch move to handle when touch moves
    const handleTouchMove = (e) => {
      if (!this.state.isDragging || e.touches.length !== 1) return;
      e.preventDefault(); // Prevent default touch behaviors
      
      const currentTime = Date.now();
      const deltaTime = currentTime - this.state.lastTime;
      
      if (deltaTime > 0) {
        // Calculate velocity (pixels per millisecond)
        this.state.velocityX = (e.touches[0].clientX - this.state.lastX) / deltaTime;
        this.state.velocityY = (e.touches[0].clientY - this.state.lastY) / deltaTime;
      }
      
      this.state.offsetX += e.touches[0].clientX - this.state.lastX;
      this.state.offsetY += e.touches[0].clientY - this.state.lastY;
      this.state.lastX = e.touches[0].clientX;
      this.state.lastY = e.touches[0].clientY;
      this.state.lastTime = currentTime;

      // Apply constraints
      this.constrainVerticalPan();
      this.handleHorizontalWrapping();

      this.redraw();
    };

    // Add global event listeners
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    // Store cleanup function
    this.cleanup = () => {
      document.removeEventListener("wheel", this.handleWheel);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }

  // Cleanup method to remove event listeners
  destroy() {
    if (this.cleanup) {
      this.cleanup();
    }
  }
} 