import assert from "node:assert/strict";
import { test } from "node:test";
import { escaparHtml } from "./html.js";

test("escaparHtml neutraliza etiquetas, comillas y ampersand", () => {
  assert.equal(
    escaparHtml(`<script>alert("x")</script>&'`),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;"
  );
});

test("escaparHtml deja el texto normal igual", () => {
  assert.equal(escaparHtml("GitLab rechazó el acceso: access_denied"), "GitLab rechazó el acceso: access_denied");
});
