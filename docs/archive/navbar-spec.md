The navbar has 3 horizontal sectors. Left, Right and Center
The left is left aligned
The right is right aligned
The center is right aligned.

If a section is empty, it's width should shrink to 0 


There should be a desktop and mobile view.

The basic layout of the navbar should be as follows:

============( Navbar Layout )==============
The desktop view should be as follows:
- Left Section
    - Nav Logo: A logo that fits itself to the height of the navbar
- Middle Secion
    - Empty
- Right Section
    - Nav Links: A dynamic listing of links passed in by the navlinks prop ( title & href )
    - CTAs: A dynamic rendering of themed buttons passed in by the cta prop ( title & callback function )
    - Specialty components: Anything else which should be rendered in this slot


The mobile view should be as follows:
- Left Section
    - Nav Logo: A logo that fits itself to the height of the navbar
- Middle Secion
    - Empty
- Right Section
    - Hamburger button / X button ( depending on if nav list is open or closed)
    - Specialty components: Anything else which should be rendered in this slot
- Expanding nav list ( vertically under the navbar )
    - Nav Links: A dynamic listing of links passed in by the navlinks prop ( title & href )
    - CTAs: A dynamic rendering of themed buttons passed in by the cta prop ( title & callback function )
======================================


The above details the basic layout controls of the navbar.

In order to serve multiple disparate use cases, it should be possible to assemble various navbars with relative ease


Here is what the in-app navbar could look like:

============( IN-APP Navbar)==============
The desktop view should be as follows:
- Left Section
    - Nav Logo: A logo that fits itself to the height of the navbar
- Middle Secion
    - Empty
- Right Section
    - Nav Links: A dynamic listing of links passed in by the navlinks prop ( title & href )
    - CTAs: A dynamic rendering of themed buttons passed in by the cta prop ( title & callback function )
    - Avatar: A specialty component - A display of the user's avatar with a menu dropdown


The mobile view should be as follows:
- Left Section
    - Nav Logo: A logo that fits itself to the height of the navbar
- Middle Secion
    - Empty
- Right Section
    - Hamburger button / X button ( depending on if nav list is open or closed)
- Expanding nav list ( vertically under the navbar )
    - Nav Links: A dynamic listing of links passed in by the navlinks prop ( title & href )
    - CTAs: A dynamic rendering of themed buttons passed in by the cta prop ( title & callback function )
=============================

Conversly, here is what a simplified marketing navbar could look like:


============( Marketing Navbar)==============
( Marketing Navbar)
The desktop view should be as follows:
- Left Section
    - Nav Logo: A logo that fits itself to the height of the navbar
- Middle Secion
    - Empty
- Right Section
    - Nav Links: A dynamic listing of links passed in by the navlinks prop ( title & href )
    - CTAs: "A dynamic rendering of themed buttons passed in by the cta prop ( title & callback function )"


The mobile view should be as follows:
- Left Section
    - Nav Logo: A logo that fits itself to the height of the navbar
- Middle Secion
    - Empty
- Right Section
    - Hamburger button / X button ( depending on if nav list is open or closed)
- Expanding nav list ( vertically under the navbar )
    - Nav Links: A dynamic listing of links passed in by the navlinks prop ( title & href )
    - CTAs: A dynamic rendering of themed buttons passed in by the cta prop ( title & callback function )
=============================






The file structure and usage

I am envisioning a structure where there is a
- navbar.tsx - The main navbar component which can be imported and used
- navbar-desktop.tsx - The navbar's desktop layout and desktop specific features
- navbar-mobile.tsx - The navbar's mobile layout and mobile specific features
- presets/ - A folder for storing preset navbar configurations
- presets/app.tsx - A wrapper around navbar with the links/ctas/specialty stuff already configured for real app usage
- presets/marketing.tsx - A wrapper around navbar with the links/ctas/specialty stuff already configured for marketing sites
- custom/ - A folder to store all custom or specialty navbar components
- custom/avatar-menu.tsx - The avatar icon w/ dropdown menu and all its advanced sections
