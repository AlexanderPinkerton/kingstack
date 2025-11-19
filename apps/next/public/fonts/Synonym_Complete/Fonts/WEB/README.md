# Installing Webfonts
Follow these simple Steps.

## 1.
Put `synonym/` Folder into a Folder called `fonts/`.

## 2.
Put `synonym.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `synonym.css` depends on your Website Filesystem.

## 4.
Import `synonym.css` at the top of you main Stylesheet.

```
@import url('synonym.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Synonym-Extralight;
font-family: Synonym-Light;
font-family: Synonym-Regular;
font-family: Synonym-Medium;
font-family: Synonym-Semibold;
font-family: Synonym-Bold;
font-family: Synonym-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 700.0

Available axes:
'wght' (range from 200.0 to 700.0

