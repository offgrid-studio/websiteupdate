// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
    const shape = document.getElementById('morphing-shape');
    const textContent = document.getElementById('text-content');
    
    // Get references to the test squares
    const redSquare = document.getElementById('red-square');
    const blueSquare = document.getElementById('blue-square');
    const greenSquare = document.getElementById('green-square');
    
    // Track the current state
    let isCircle = true;
    let isOpen = false;
    let isClosed = true;
    
    // Define all text states
    const textStates = {
        initial: 'This is a dynamic text box that automatically resizes to fit its content. Click anywhere on the shape to toggle between circle and box states.',
        hoverRed: 'Hi I\'m Cora and I like making you suffer',
        hoverBlue: 'Hi I\'m Kore and I don\'t mind',
        hoverTurq: 'Hi I\'m offgrid and I make noise'
    };
    
    // Working typewriter effect with interruption protection
    let currentTypewriterTimer = null;
    
    function typewriterEffect(element, text, speed = 50) {
        // Clear any existing typewriter animation
        if (currentTypewriterTimer) {
            clearTimeout(currentTypewriterTimer);
            currentTypewriterTimer = null;
        }
        
        element.textContent = '';
        let i = 0;
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                currentTypewriterTimer = setTimeout(type, speed);
            } else {
                currentTypewriterTimer = null;
            }
        }
        
        type();
    }
    
    // Morph from circle to box shape
    function morphToBox() {
        // Remove pulsating shadow
        shape.classList.remove('pulse-shadow');
        
        // Use fixed dimensions that work well with the text content
        const boxWidth = 400;
        const boxHeight = 200;
        
        gsap.to(shape, {
            duration: 0.75,
            width: boxWidth + "px",
            height: boxHeight + "px",
            ease: "power2.inOut",
            onComplete: () => {
                // Show text content with typewriter effect after shape morphs
                gsap.to(textContent, { duration: 0.3, opacity: 1 });
                typewriterEffect(textContent, textStates.initial, 30);
            }
        });
        
        isCircle = false;
        isOpen = true;
        isClosed = false;
    }
    
    // Morph from box to circle shape
    function morphToCircle() {
        // Fade out text content first, then morph shape
        gsap.to(textContent, { 
            duration: 0.3, 
            opacity: 0,
            onComplete: () => {
                // Only morph shape after text has faded out
                gsap.to(shape, {
                    duration: 0.75,
                    width: "50px",
                    height: "50px",
                    ease: "power2.inOut"
                });
                
                // Add pulsating shadow back
                shape.classList.add('pulse-shadow');
                
                isCircle = true;
                isOpen = false;
                isClosed = true;
            }
        });
    }
    
    // Start with pulsating shadow (closed state)
    shape.classList.add('pulse-shadow');
    
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
    
    // Dynamic text content based on square hover
    redSquare.addEventListener('mouseenter', function() {
        if (isOpen) {
            typewriterEffect(textContent, textStates.hoverRed, 30);
        }
    });
    
    blueSquare.addEventListener('mouseenter', function() {
        if (isOpen) {
            typewriterEffect(textContent, textStates.hoverBlue, 30);
        }
    });
    
    greenSquare.addEventListener('mouseenter', function() {
        if (isOpen) {
            typewriterEffect(textContent, textStates.hoverTurq, 30);
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
