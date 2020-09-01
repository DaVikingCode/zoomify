# Zoomify
Zoomify is a javascript custom element that allow you to zoom into an image and create geometry. Zoomify is compatible with touchscreens, so you can pinch to zoom on your images and draw very well.
Feel free to use this library, report all the bugs you can find and if i have the time for, i'll make the best i can to fix them all.
Thanks to credit my work if you are using this library :)

## Installation
You can use NPM to install zoomify into your project :
```bash
npm install @davikingcode/zoomify@1.0.0
```

## Usage
Follow these simples steps to use Zoomify :
- First, you have to add the custom element into your html. Due to a little issue, you have to use a container to make the library work correctly. You can have the following syntaxe :
```html
<!-- Container needed to make the component work well -->
<div class="container">
   <zoomify-img id="photo" class="zoomable-image"></zoomify-img>
</div>
```
- Next, you should add some rules to your css file to declare you container as a relative parent and to define the size of your elements :
```css
.container {
  display: block;
  position: relative;
  width: 555px;
  height: 320px;
}

.zoomable-image {
    display: block;
    width: 555px;
    height: 320px;
    margin-bottom: 15px;

    background-size: contain;
    background-position: 50% 50%;
    background-repeat: no-repeat;
}
```
- Finally, you can add some js code to run the custom element. First thing you have to know, is that a custom element can't modify DOM elements in the constructor. So we have to use an initializing function to make this possible. The problem is that you need to specify your image size in this function. If you don't know the size of your image, you can use this simple function :
```js
window.addEventListener('load', () => {
    let img = new Image();

    img.addEventListener('load', () => {
        document.querySelector('zoomify-img').init(img.width, img.height);
        img = null;
    });
    img.src = '../assets/daisy.jpg';
    photo.style.backgroundImage = "url('../assets/daisy.jpg')";
});
```
In this example, i'm loading my image when the page is loaded. If you want to control the loading of your image, you should create a function with this code.
As you can see, you have to set your image as the css property `background-image`. We are using an Image instance to get the width and the height of the image. Once the image have been loaded from the Image instance, we can call the init function of the component.

## Draw geometry
To draw polygons with Zoomify, you have to set the property canDraw of the component to true. If you want to allow drawing after clicking a button, you can use the following code : 
```js
function startDrawing() {
  photo.canDraw = true;
}
document.getElementById('button').addEventListener('click', startDrawing);
```
Notice that when you polygon is ended, the property canDraw will be set to false.

## Listening event
Zoomify allow you to call an event called `drawn` when a polygon has been drawn.
The only thing you have to do is to add an event listener :
```js
document.querySelector('zoomify-img').addEventListener('drawn', () => { alert('Geometry has been drawn.'); });
```
Do not hesitate to use this event to perform some tasks after drawing a polygon.
