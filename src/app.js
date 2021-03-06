/*
 *
 * MIT License
 *
 * Copyright (c) 2020 akaadream @ Da Viking Code
 *
 */

/**
 * Point class
 */
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    inArea(other) {
        return (other.x >= this.x - 15) && (other.x <= this.x + 15) && (other.y >= this.y - 15) && (other.y <= this.y + 15);
    }
}

/**
 * Polygon class
 */
class Polygon {
    constructor(array, color) {
        this.color = color;

        this.points = array;
    }
}

/**
 * Custom element : <zoomify-img></zoomify-img>
 */
customElements.define('zoomify-img',
    class extends HTMLElement {
        /**
         * Constructor method
         */
        constructor() {
            super();

            // parameters
            this.color = '#ff3333';

            // data
            this.markers = [];
            this.polygons = [];
            this.currentPosition = null;

            // booleans
            this.isDrawing = false;
            this.canDraw = false;
        }

        /**
         * Initialize the element
         * @param w number
         * @param h number
         */
        init(w, h) {
            // Initialize component parameters
            // Default width / height
            this.startWidth = w;
            this.startHeight = h;

            // New width / height (to fit the container)
            if (w > h) {
                let ratio = w / h;
                this.width = this.defaultWidth = this.clientWidth;
                this.height = this.defaultHeight = this.width / ratio;
            }
            else {
                let ratio = h / w;
                this.height = this.defaultHeight = this.clientHeight;
                this.width = this.defaultWidth = this.height / ratio;
            }

            // Container
            this.containerWidth = this.clientWidth;
            this.containerHeight = this.clientHeight;
            this.containerX = this.offsetLeft;
            this.containerY = this.offsetTop;

            // Get the initial position of the image
            this.x = this.defaultX = this.height > this.width ? (this.clientWidth / 2) - (this.width / 2) : 0;
            this.y = this.defaultY = this.width > this.height ? (this.clientHeight / 2) - (this.height / 2) : 0;

            // Default zoom speed
            this.zoomSpeed = 0.1;

            // Dragging parameters
            this.dragging = false;
            this.wasDragging = false;
            this.hasMoved = false;
            this.startDragX = 0;
            this.startDragY = 0;
            this.dragX = 0;
            this.dragY = 0;

            // Scaling parameters (pinch)
            this.scaling = false;
            this.touchDistance = 0;
            this.touchCenterX = 0;

            // Geometry variables
            this.markers = [];
            this.polygons = [];
            this.touchCenterY = 0;

            // Get the component bounding rectangle
            this.rect = this.getBoundingClientRect();

            // Mouse wheel event
            this.addEventListener('wheel', this.zoom);

            // Touch screen start event
            this.addEventListener('touchstart', this.touchStart);

            // Touch screen move event
            this.addEventListener('touchmove', this.touchMove);

            // Touch screen end event
            this.addEventListener('touchend', this.touchEnd);

            // Mouse click event
            this.addEventListener('click', this.photoClicked);

            // Mouse down event
            this.addEventListener('mousedown', this.startDrag);

            // Mouse move event
            this.addEventListener('mousemove', this.drag);

            // Mouse up event
            this.addEventListener('mouseup', this.endDrag);

            // Mouse leave event
            this.addEventListener('mouseleave', () => {
                this.dragging = false;
                this.dragX = 0;
                this.dragY = 0;
            });

            // Key up event
            window.addEventListener('keyup', (event) => {
                if (event.key === "Escape") this.cancelCurrent(false);
            });

            // Update components style
            this.updateStyle();
            // Render geometry
            this.render();
        }

        /**
         * Export a polygon into geometry string for the database
         * @returns {string}
         */
        export()
        {
            if (this.polygons.length === 0) return;

            // Start string conversion for DB
            let s = "SRID=4326;POLYGON((";

            // Get the latest polygon made
            let polygon = this.polygons[this.polygons.length - 1];

            // For all of the polygon points
            for (let i = 0; i < polygon.points.length; i++)
            {
                // Convert coordinates into values between 0 and 1
                let pX = polygon.points[i].x / this.startWidth;
                let pY = polygon.points[i].y / this.startHeight;

                // Update string conversion
                s += pX + " " + pY + ", ";
            }

            // Add the first point again to get a cycle
            let px = polygon.points[0].x / this.startWidth;
            let py = polygon.points[0].y / this.startHeight;

            // End of the string conversion
            s += px + " " + py;
            s += "))";

            // Return the string geometry
            return s;
        }

        /**
         * Check if we are clicking on an existing point // Maybe update it to check only the first point of the geometry
         * @param event
         * @returns {boolean}
         */
        clickingOnExistingPoint(event) {
            // Check for all markers
            for (let i = 0; i < this.markers.length; i++) {
                // If we are clicking in the marker area
                if (this.markers[i].inArea(this.getZoomedPoint(event))) return true;
            }

            // else
            return false;
        }

        /**
         * Add a polygon for a given array of points and a given color
         * @param poly
         * @param color
         */
        addPolygon(poly, color) {
            // Array of Point instances
            let points = [];
            // Create points from array
            for (let i = 0; i < poly.length; i++) {
                let pX = poly[i][0] * this.startWidth;
                let pY = poly[i][1] * this.startHeight;
                // Point instance
                points.push(new Point(pX, pY));
            }

            // Create polygon with new points array and the given color
            let polygon = new Polygon(points, color);
            // Push the polygon
            this.polygons.push(polygon);
            // Rendering
            this.render();
        }

        /**
         * On touch start event (mobile)
         * @param event
         */
        touchStart(event) {
            // If we're using two finger on the touch event
            if (event.touches.length === 2) {
                // Start the pinch state
                this.scaling = true;
                this.pinchStart(event);
            }
            // Else it's a dragging state
            else if (event.touches.length === 1) {
                this.touchCenterX = event.touches[0].pageX;
                this.touchCenterY = event.touches[0].pageY;
                this.startDrag(event);
            }
            // Or just cancel the default comportment
            else event.preventDefault();
        }

        /**
         * On touch move event (mobile)
         * @param event
         */
        touchMove(event) {
            if (this.scaling) this.pinchMove(event);
            else if (this.dragging) {
                this.touchCenterX = event.touches[0].pageX;
                this.touchCenterY = event.touches[0].pageY;
                this.drag(event);
            }
            else event.preventDefault();
        }

        /**
         * On touch end event (mobile)
         * @param event
         */
        touchEnd(event) {
            if (this.scaling) {
                this.pinchEnd(event);
                this.scaling = false;
            }
            else if (this.dragging) {
                this.photoClicked(event);
                this.endDrag(event);
            }
            else event.preventDefault();
        }

        /**
         * On pinch start event (mobile)
         * @param event
         */
        pinchStart(event) {
            // Initialize parameters for the pinch
            this.touchCenterX = Math.abs(event.touches[0].pageX);
            this.touchCenterY = Math.abs(event.touches[0].pageY);
            this.touchDistance = Math.hypot(
                event.touches[0].pageX - event.touches[1].pageX,
                event.touches[0].pageY - event.touches[1].pageY);
        }

        /**
         * On pinch move event (mobile)
         * @param event
         */
        pinchMove(event) {
            // Get the distance of the pinch
            let newDist = Math.hypot(
                event.touches[0].pageX - event.touches[1].pageX,
                event.touches[0].pageY - event.touches[1].pageY);

            // If the new distances of the pinch is higher than the previous one
            if (newDist > this.touchDistance) {
                // zoomify in
                this.zoom(event, -1);
            }
            // Else the new distance is lower
            else if (newDist < this.touchDistance) {
                // zoomify out
                this.zoom(event, 1);
            }

            // Update touch distance
            this.touchDistance = newDist;
        }

        /**
         * On pinch end event (mobile)
         * @param event
         */
        pinchEnd(event) {
            // Reset touch variables
            this.touchDistance = 0;
            this.touchCenterX = 0;
            this.touchCenterY = 0;
        }


        /**
         * Reset current element style
         */
        reset() {
            // Reset style parameters
            this.width = this.defaultWidth;
            this.height = this.defaultHeight;
            this.x = this.y = 0;
            // Update css element style
            this.updateStyle();
        }

        /**
         * Cancel the current geometry
         */
        cancelCurrent(everything = true)
        {
            // Reset variables
            this.markers = [];
            if (everything && this.polygons.length > 0) this.polygons.pop();
            this.render();
            this.currentPosition = null;
            this.isDrawing = false;
            this.canDraw = false;
        }

        /**
         * On photo clicked event
         * @param event
         */
        photoClicked(event) {
            // Check for drawing state
            if (!this.hasMoved && this.canDraw)
            {
                // Define the drawing state
                if (!this.isDrawing) this.isDrawing = true;

                // Clicking on an existing point
                if (this.clickingOnExistingPoint(event))
                {
                    // Add geometry as a new polygon
                    // And update parameters / states
                    this.isDrawing = false;
                    this.polygons.push(new Polygon(this.markers, this.color));
                    this.markers = [];
                    this.currentPosition = null;
                    this.canDraw = false;

                    // Create custom event (drawn)
                    const event = document.createEvent('Event');
                    event.initEvent('drawn', true, true);
                    // Dispatch it
                    this.dispatchEvent(event);
                }
                // Adding a new point
                else {
                    let point = this.getZoomedPoint(event);
                    this.markers.push(point);
                }
            }

            // If we clicked, we cancel any dragging state
            this.wasDragging = false;
            this.hasMoved = false;

            // Render polygons
            this.render();

            // Cancel default click event
            event.preventDefault();
        }

        /**
         * Start dragging event
         * @param event
         */
        startDrag(event) {
            // If we are not currently dragging
            if (!this.dragging)
            {
                // If we got coordinates for touchscreen
                if (this.touchCenterX !== 0 || this.touchCenterY !== 0) {
                    // Update dragging position
                    this.dragX = this.startDragX = this.touchCenterX;
                    this.dragY = this.startDragY = this.touchCenterY;
                }
                // Else it's mouse position
                else {
                    // Update dragging position
                    this.dragX = this.startDragX = event.clientX;
                    this.dragY = this.startDragY = event.clientY;
                }
                // Update dragging state
                this.dragging = true;
            }

            // Cancel default comportment
            event.preventDefault();
        }

        /**
         * Get a zoomed point for a given location
         * @param event
         * @returns {Point}
         */
        getZoomedPoint(event) {
            // Get the canvas element
            let canvas = document.getElementById('canvas');

            // Initialize coordinates
            let x = 0;
            let y = 0;

            // Detect touchscreen usage
            if (this.touchCenterX !== 0 && this.touchCenterY !== 0)
            {
                // Get current coordinates
                x = this.touchCenterX - this.rect.x - this.x;
                y = this.touchCenterY - this.rect.y - this.y;
            }
            else
            {
                // Get current coordinates
                x = event.pageX - this.rect.x - this.x;
                y = event.pageY - this.rect.y - this.y;
            }

            // Calculate ratios
            let ratioZoom = this.height / this.defaultHeight;

            // Vertical image
            let ratioImg = this.startHeight / canvas.height;
            // Horizontal image
            if (this.startWidth > this.startHeight) ratioImg = this.startWidth / canvas.width;

            // Return the point
            return new Point(x / ratioZoom * ratioImg, y / ratioZoom * ratioImg);
        }

        /**
         * On dragging event
         * @param event
         */
        drag(event) {
            // If we can perform dragging
            if (this.dragging) {
                // Touch screen
                if (this.touchCenterX !== 0 || this.touchCenterY !== 0) {
                    // Update the image position
                    this.x += (this.touchCenterX - this.dragX);
                    this.y += (this.touchCenterY - this.dragY);

                    // If we can consider user moved the image
                    if (Math.abs(this.touchCenterX - this.startDragX) >= 20 || Math.abs(this.touchCenterY - this.startDragY) >= 20) {
                        this.hasMoved = true;
                    }

                    // Update current drag position
                    this.dragX = this.touchCenterX;
                    this.dragY = this.touchCenterY;
                }
                // Not a touch screen
                else {
                    // Update the image position
                    this.x += (event.pageX - this.dragX);
                    this.y += (event.pageY - this.dragY);

                    // If we can consider user moved the image
                    if (Math.abs(event.pageX - this.startDragX) >= 20 || Math.abs(event.pageY - this.startDragY) >= 20) {
                        this.hasMoved = true;
                    }

                    // Update current drag position
                    this.dragX = event.pageX;
                    this.dragY = event.pageY;
                }

                // Update the previous dragging state
                this.wasDragging = true;

                // Update component style
                this.updateStyle();
                // Render geometry
                this.render();
            }
            // If we are on a drawing state
            if (this.isDrawing && this.canDraw) {
                // If the mouse position is close to the first point
                if (this.markers[0].inArea(this.getZoomedPoint(event))) {
                    // Magnet to the first point
                    this.currentPosition = this.markers[0];
                }
                // Else
                else {
                    // Update the current position to the mouse position relative to the component
                    this.currentPosition = this.getZoomedPoint(event);
                }

                // Render geometry
                this.render();
            }

            // Cancel default comportment
            event.preventDefault();
        }

        /**
         * At the end of the dragging event
         * @param event
         */
        endDrag(event) {
            // Reset dragging variables
            this.dragging = false;
            this.touchCenterX = 0;
            this.touchCenterY = 0;
            this.startDragX = 0;
            this.startDragY = 0;

            // Cancel default comportment
            event.preventDefault();
        }

        /**
         * Rendering everything
         */
        render()
        {
            // Get the canvas context
            let canvas = this.getCanvas();
            let ctx = canvas.getContext('2d');

            // Clear the current context to redraw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Drawing parameters
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.color;
            ctx.fillStyle = this.color;

            // Render the geometry we're currently doing
            this.renderArray(ctx, this.markers, true, true);
            // Render every polygons we made
            this.polygonsRender();
        }

        /**
         * Render a specific array
         * @param ctx
         * @param array
         * @param showMarkers
         * @param current
         */
        renderArray(ctx, array, showMarkers = true, current = false)
        {
            ctx.beginPath();
            if (current) {
                ctx.setLineDash([15, 5]);
            }

            let canvas = document.getElementById('canvas');
            let ratioZoom = this.width / this.startWidth;
            for (let i = 0; i < array.length; i++) {
                let pointX = (array[i].x * ratioZoom + this.x - canvas.offsetLeft);
                let pointY = (array[i].y * ratioZoom + this.y - canvas.offsetTop);

                if (showMarkers) {
                    if (i === 0) ctx.fillStyle = "#ffffff";
                    ctx.fillRect(pointX - 5, pointY - 5, 10, 10);
                    if (i === 0) ctx.fillStyle = this.color;
                }

                if (i === 0) {
                    ctx.moveTo(pointX, pointY);
                }
                else ctx.lineTo(pointX, pointY);
            }

            if (current && this.isDrawing && this.currentPosition !== null) {
                ctx.lineTo(this.currentPosition.x * ratioZoom + this.x - canvas.offsetLeft, this.currentPosition.y * ratioZoom + this.y - canvas.offsetTop);
            }

            if ((!current || !this.isDrawing) && array.length > 0) {
                ctx.lineTo(array[0].x * ratioZoom + this.x - canvas.offsetLeft, array[0].y * ratioZoom + this.y - canvas.offsetTop);
                ctx.closePath();
            }

            ctx.stroke();
            if (current) {
                ctx.setLineDash([]);
            }
        }

        /**
         * Render existing polygons
         */
        polygonsRender()
        {
            let canvas = this.getCanvas();
            let ctx = canvas.getContext('2d');

            ctx.lineWidth = 2;

            for (let i = 0; i < this.polygons.length; i++) {
                ctx.strokeStyle = this.polygons[i].color;
                ctx.fillStyle = this.polygons[i].color;
                this.renderArray(ctx, this.polygons[i].points, false, false);
            }
        }

        /**
         * Clear content
         */
        dispose()
        {
            // Reset main variables + canvas
            this.markers = [];
            this.polygons = [];
            this.canDraw = false;
            if (this.childElementCount > 0) {
                this.firstChild.remove();
            }
        }

        /**
         * Get the canvas we're using to draw geometry or create it if it does not exist
         * @returns {HTMLElement}
         */
        getCanvas()
        {
            // Try to get canvas
            let canvas = document.getElementById('canvas');
            // If it does not exist
            if (!canvas) {
                // Create it with some parameters
                canvas = document.createElement('canvas');
                canvas.setAttribute('width', this.defaultWidth);
                canvas.setAttribute('height', this.defaultHeight);
                canvas.setAttribute('id', 'canvas');
                canvas.style.marginTop = this.defaultY + "px";
                canvas.style.marginLeft = this.defaultX + "px";
                // Add canvas to this custom element
                this.appendChild(canvas);
            }

            // Return canvas
            return canvas;
        }

        /**
         * Perform zoom in a given direction
         * @param event
         * @param zoomDirection
         */
        zoom(event, zoomDirection = 0) {
            // Direction of the scroll // good values
            let toTop = zoomDirection < 0 ? true : event.deltaY < 0;
            let toBottom = zoomDirection > 0 ? true : event.deltaY > 0;

            // Get rect
            let rect = this.getBoundingClientRect();

            // Mouse position relative to the image coordinates // good values
            let offsetX = event.pageX - rect.left - window.pageXOffset;
            let offsetY = event.pageY - rect.top - window.pageYOffset;

            if (zoomDirection !== 0) {
                offsetX = this.touchCenterX - rect.left - window.pageXOffset;
                offsetY = this.touchCenterY - rect.top - window.pageYOffset;
            }

            let cursorX = offsetX - this.x;
            let cursorY = offsetY - this.y;

            // Get the ratio of the mouse relative to the image (0 to 1) // good values
            let containerRatioX = cursorX / this.width;
            let containerRatioY = cursorY / this.height;

            // zoomify // good values
            if (toTop && this.width < this.containerWidth * 4) {
                this.width += this.width * this.zoomSpeed;
                this.height += this.height * this.zoomSpeed;
            }
            else if (toBottom && this.width > this.defaultWidth) {
                this.width -= this.width * this.zoomSpeed;
                this.height -= this.height * this.zoomSpeed;
            }

            // Min zoom
            if (this.width < this.defaultWidth) this.width = this.defaultWidth;
            if (this.height < this.defaultHeight) this.height = this.defaultHeight;

            // Update the coordinates of the image
            this.x = offsetX - (this.width * containerRatioX);
            this.y = offsetY - (this.height * containerRatioY);

            // If we have to reset variables
            if (this.width <= this.defaultWidth || this.height <= this.defaultHeight) this.reset();
            // Else update css style of this element
            else this.updateStyle();

            // Update canvas style
            this.updateCanvas();
            // Render geometry
            this.render();

            // Cancel default comportment
            event.preventDefault();
        }

        /**
         * Update the canvas style
         */
        updateCanvas() {
            // Get canvas element
            let canvas = document.getElementById('canvas');

            // If it's horizontal image
            if (this.defaultWidth > this.defaultHeight) {
                let h = this.height;
                if (h > this.rect.height) h = this.rect.height;
                canvas.setAttribute('height', h);
                let top = (this.defaultY + this.y) / 2;
                if (top < 0 || this.height > this.rect.height) top = 0;
                canvas.style.marginTop = top + "px";
            }
            // Else if it's vertical image
            else {
                let w = this.width;
                if (w > this.rect.width) w = this.rect.width;
                canvas.setAttribute('width', w);
                let left = (this.defaultX + this.x) / 2;
                if (left < 0 || this.width > this.rect.width) left = 0;
                canvas.style.marginLeft = left + "px";
            }
        }

        /**
         * Update component style
         */
        updateStyle() {
            // Check for image travel
            if (this.x > 0) this.x = 0; // good
            else if (this.x < this.defaultWidth - this.width) { this.x = this.defaultWidth - this.width; }

            if (this.y > 0) { this.y = 0; } // good
            else if (this.y < this.defaultHeight - this.height) { this.y = this.defaultHeight - this.height; }

            if (this.width > this.height) {
                if (this.height < this.clientHeight) {
                    this.y = this.defaultY = this.width > this.height ? (this.clientHeight / 2) - (this.height / 2) : 0;
                }
            }
            else {
                if (this.width < this.clientWidth) {
                    this.x = this.defaultX = this.height > this.width ? (this.clientWidth / 2) - (this.width / 2) : 0;
                }
            }

            // Update zoom and position display
            this.style.backgroundSize = this.width + 'px ' + this.height + 'px';
            this.style.backgroundPosition = this.x + 'px ' + this.y + 'px';
        }
    });
