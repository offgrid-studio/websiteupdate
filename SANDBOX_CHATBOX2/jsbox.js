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
    
    function typewriterEffect(element, text, speed = 15) {
        // Clear any existing typewriter animation
        if (currentTypewriterTimer) {
            clearTimeout(currentTypewriterTimer);
            currentTypewriterTimer = null;
        }
        
        element.textContent = '';
        let i = 0;
        
        // Add voice-like pulsating shadow during typing
        shape.classList.add('voice-pulse');
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                
                // Add mechanical randomness to timing
                const baseSpeed = speed;
                const randomVariation = Math.random() * 10 - 0; // ±20ms variation
                const mechanicalSpeed = baseSpeed + randomVariation;
                
                // Check if we just typed a sentence ending
                const currentChar = text.charAt(i - 1);
                const sentencePause = (currentChar === '.' || currentChar === '!' || currentChar === '?') ? 150 : 0;
                
                // Occasionally add longer pauses (like human thinking)
                const thinkingPause = Math.random() < 0.2 ? 40 : 0; // 10% chance of 150ms pause
                
                currentTypewriterTimer = setTimeout(type, mechanicalSpeed + thinkingPause + sentencePause);
            } else {
                currentTypewriterTimer = null;
                // Remove voice-like pulsing when typing is complete
                shape.classList.remove('voice-pulse');
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
        const boxHeight = 100;
        
        gsap.to(shape, {
            duration: 0.75,
            width: boxWidth + "px",
            height: boxHeight + "px",
            ease: "power2.inOut",
            onComplete: () => {
                // Show text content with typewriter effect after shape morphs
                gsap.to(textContent, { duration: 0.3, opacity: 1 });
                typewriterEffect(textContent, textStates.initial, 5);
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
    
    // Function to add pill buttons
    function addPillButtons() {
        // Clear existing content and add text + pills
        textContent.innerHTML = textStates.initial + '<br><br><div class="pill-button" id="pill-1">1) Show me interesting projects</div><div class="pill-button" id="pill-2">2) Learn about us</div>';
        
        // Pills are now ready for you to add custom functionality later
        // Example: if click pill-1 do XYZ, if click pill-2 do ABC
    }
    
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
            typewriterEffect(textContent, textStates.hoverRed, 15);
        }
    });
    
    redSquare.addEventListener('mouseleave', function() {
        if (isOpen) {
            // Stop any running typewriter animation
            if (currentTypewriterTimer) {
                clearTimeout(currentTypewriterTimer);
                currentTypewriterTimer = null;
            }
            // Display initial text without animation
            textContent.textContent = textStates.initial;
        }
    });
    
    blueSquare.addEventListener('mouseenter', function() {
        if (isOpen) {
            typewriterEffect(textContent, textStates.hoverBlue, 15);
        }
    });
    
    blueSquare.addEventListener('mouseleave', function() {
        if (isOpen) {
            // Stop any running typewriter animation
            if (currentTypewriterTimer) {
                clearTimeout(currentTypewriterTimer);
                currentTypewriterTimer = null;
            }
            // Display initial text without animation
            textContent.textContent = textStates.initial;
        }
    });
    
    greenSquare.addEventListener('mouseenter', function() {
        if (isOpen) {
            typewriterEffect(textContent, textStates.hoverTurq, 15);
        }
    });
    
    greenSquare.addEventListener('mouseleave', function() {
        if (isOpen) {
            // Stop any running typewriter animation
            if (currentTypewriterTimer) {
                clearTimeout(currentTypewriterTimer);
                currentTypewriterTimer = null;
            }
            // Display initial text without animation
            textContent.textContent = textStates.initial;
        }
    });
    
    // Add some interactive hover effects
    shape.addEventListener('mouseenter', function() {
        gsap.to(shape, {
            duration: 0.3,
            scale: 1.05,
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
