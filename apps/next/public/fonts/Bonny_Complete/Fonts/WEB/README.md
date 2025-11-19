# Installing Webfonts
Follow these simple Steps.

## 1.
Put `bonny/` Folder into a Folder called `fonts/`.

## 2.
Put `bonny.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `bonny.css` depends on your Website Filesystem.

## 4.
Import `bonny.css` at the top of you main Stylesheet.

```
@import url('bonny.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Bonny-Thin;
font-family: Bonny-Light;
font-family: Bonny-Regular;
font-family: Bonny-Medium;
font-family: Bonny-Bold;
font-family: Bonny-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 700.0

Available axes:
'wght' (range from 100.0 to 700.0

