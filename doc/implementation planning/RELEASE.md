release:
    - bundling css files
    - bundling javascript
    - run index.html template for release as opposed to develop version?
    - make list of all resources needed (images, html page)
    - create appcache manifest + service worker
    - create tarball + sign
    - make gh release with tarball + signature
publish:
    - extract tarball
    - upload to static website
        - overwrite index.html
        - overwrite service worker & appcache manifest
        - put new version files under /x.x.x
