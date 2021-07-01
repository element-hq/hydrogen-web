# Ideas for formatted messages

* Seems like a good idea to take some
  inspiration from [Pandoc's AST](https://hackage.haskell.org/package/pandoc-types-1.22/docs/Text-Pandoc-Definition.html#t:Block).
  Then, much like Pandoc AST, we can turn our representation into
  markdown in the editor, or HTML in the view.
* As such, we represent formatting by nesting parts
  (we'd have a `ItalicsPart`, `BoldPart`, etc.)
* We keep the "inline"/"block" distinction, but only
  track it as a property, so that we can avoid adding
  block parts to elements that cannot contain blocks
  (headers, for instance, cannot contain blocks, but
  lists -- themselves blocks -- can).
* When parsing, we may need some sort of "permanent" context:
  if we're parsing a header, and we are inside 3 layers of other
  "inline" things (italics, strikethrough, and bold, for example),
  and we encounter a block, that's still not valid.
  * Element seems to not care at all about the validity of what
    it's parsing. Do we assume the HTML is well-formatted, then?
