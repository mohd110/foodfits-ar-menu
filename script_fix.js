// Add this to beginning of placeFood function
console.log('SCRIPT LOADED - Food image element exists:', document.getElementById('food') !== null);

// Ensure SVG loads on start
window.addEventListener('load', () => {
  console.log('Window loaded');
  const foodElement = document.getElementById('food');
  if (foodElement) {
    foodElement.src = 'pizza.svg';
    console.log('Food src set to pizza.svg on load');
  }
});
