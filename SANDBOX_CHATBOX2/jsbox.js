// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
    const shape = document.getElementById('morphing-shape');
    
    // Track the current state
    let isCircle = true;
    let isOpen = false;
    let isClosed = true;
    
    // Morph from circle to box shape
    function morphToBox() {
        gsap.to(shape, {
            duration: 0.75,
            width: "350px",
            height: "150px",
            ease: "power2.inOut"
        });
        isCircle = false;
        isOpen = true;
        isClosed = false;
    }
    
    // Morph from box to circle shape
    function morphToCircle() {
        gsap.to(shape, {
            duration: 0.75,
            width: "50px",
            height: "50px",
            ease: "power2.inOut"
        });
        isCircle = true;
        isOpen = false;
        isClosed = true;
    }
    
    // Auto-morph to box after 2 seconds on page load
    setTimeout(() => {
        morphToBox();
    }, 2000);
    
    // Make the shape draggable
    Draggable.create(shape, {
        type: "x,y",
        bounds: "body",
        inertia: true,
        onDrag: function() {
            // Optional: Add any custom behavior during drag
        }
    });
    
    // Click to toggle between circle and box
    shape.addEventListener('click', function() {
        if (isCircle) {
            morphToBox();
        } else {
            morphToCircle();
        }
    });
    
    // Add some interactive hover effects
    shape.addEventListener('mouseenter', function() {
        gsap.to(shape, {
            duration: 0.3,
            scale: 1.1,
            ease: "back.out(1.7)"
        });
    });
    
    shape.addEventListener('mouseleave', function() {
        gsap.to(shape, {
            duration: 0.3,
            scale: 1,
            ease: "power2.out"
        });
    });
});
