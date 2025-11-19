# Installing Webfonts
Follow these simple Steps.

## 1.
Put `oswald/` Folder into a Folder called `fonts/`.

## 2.
Put `oswald.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `oswald.css` depends on your Website Filesystem.

## 4.
Import `oswald.css` at the top of you main Stylesheet.

```
@import url('oswald.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Oswald-ExtraLight;
font-family: Oswald-Light;
font-family: Oswald-Regular;
font-family: Oswald-Medium;
font-family: Oswald-SemiBold;
font-family: Oswald-Bold;
font-family: Oswald-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 400.0

Available axes:
'wght' (range from 200.0 to 700.0

