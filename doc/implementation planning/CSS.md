https://nio.chat/ looks nice.

We could do top to bottom gradients in default avatars to make them look a bit cooler. Automatically generate them from a single color, e.g. from slightly lighter to slightly darker.

## How to organize the CSS?

Can take ideas/adopt from OOCSS and SMACSS.

## Documentation

Whether we use OOCSS, SMACSS or BEM, we should write a tool that uses a JS parser (acorn?) to find all css classes used in the view code by looking for a `{className: "..."}` pattern. E.g. if using BEM, use all the found classes to construct a doc with a section for every block, with therein all elements and modifiers.

### Root
 - maybe we should not assume `body` is the root, but rather a `.brawl` class. The root is where we'd set root level css variables, fonts?, etc. Should we scope all css to this root class? That could get painful with just vanilla css. We could use something like https://github.com/domwashburn/postcss-parent-selector to only do this at build time. Other useful plugin for postcss: https://github.com/postcss/postcss-selector-parser

We would still you `rem` for size units though.

### Class names

#### View
 - view name? 

#### Not quite a View

Some things might not be a view, as they don't have their own view model.

 - a spinner,  has .spinner for now
 - avatar

#### modifier classes

are these modifiers?
 - contrast-hi, contrast-mid, contrast-low
 - font-large, font-medium, font-small

 - large, medium, small (for spinner and avatar)
 - hidden: hides the element, can be useful when not wanting to use an if-binding to databind on a css class
 - inline: can be applied to any item if it needs to look good in an inline layout
 - flex: can be applied to any item if it is placed in a flex container. You'd combine this with some other class to set a `flex` that makes sense, e.g.:
```css
.spinner.flex,
.avatar.flex,
.icon.flex,
button.flex {
    flex: 0;
}
```
you could end up with a lot of these though?

well... for flex we don't really need a class, as `flex` doesn't do anything if the parent is not a flex container.

Modifier classes can be useful though. Should we prefix them?

### Theming

do we want as system with HSL or RGBA to define shades and contrasts?

we could define colors as HS and have a separate value for L:

```
/* for dark theme */
--lightness-mod: -1;
--accent-shade: 310, 70%;
/* then at every level */
--lightness: 60%;
/* add/remove (based on dark theme) 20% lightness */
--lightness: calc(var(--lightness) + calc(var(--lightness-mod) * 20%));
--bg-color: hsl(var(-accent-shade), var(--lightness));
```

this makes it easy to derive colors, but if there is no override with rga values, could be limiting.
I guess --fg-color and --bg-color can be those overrides?

what theme color variables do we want?

 - accent color
 - avatar/name colors
 - background color (panels are shades of this?)

Themes are specified as JSON and need javascript to be set. The JSON contains colors in rgb, the theme code will generate css variables containing shades as specified? Well, that could be custom theming, but built-in themes should have full css flexibility.

what hierarchical variables do we want?

 - `--fg-color` (we use this instead of color so icons and borders can also take the color, we could use the `currentcolor` constant for this though!)
 - `--bg-color` (we use this instead of background so icons and borders can also take the color)
 - `--lightness`
 - `--size` for things like spinner, avatar
