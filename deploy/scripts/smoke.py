#!/usr/bin/env python3
"""HTTP checks against a running app; --exercise creates and archives one test book."""

import argparse
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


class SmokeFailure(RuntimeError):
    pass


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/") + "/api/v1"
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def request(self, method, path, body=None, expected=200):
        headers = {"Accept": "application/json"}
        if method not in ("GET", "HEAD"):
            csrf = self.request("GET", "/auth/csrf")
            headers[csrf["headerName"]] = csrf["token"]
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        request = urllib.request.Request(
            self.base + path, data=data, method=method, headers=headers
        )
        try:
            with self.opener.open(request, timeout=20) as response:
                status, payload = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, payload = error.code, error.read()
        if status != expected:
            try:
                code = json.loads(payload).get("code", "unexpected_response")
            except (ValueError, AttributeError):
                code = "unexpected_response"
            raise SmokeFailure(f"{method} {path}: expected {expected}, received {status} ({code})")
        return json.loads(payload) if payload else None

    def login(self, email, password):
        user = self.request("POST", "/auth/login", {"email": email, "password": password})
        current = self.request("GET", "/auth/me")
        if current["id"] != user["id"]:
            raise SmokeFailure("Session identity was not retained after sign-in")
        return user


def anonymous_checks(base):
    client = Client(base)
    page = client.request("GET", "/books?page=0&size=3")
    if not isinstance(page.get("items"), list) or "total" not in page:
        raise SmokeFailure("Catalog does not use the documented page shape")
    client.request("GET", "/categories")
    client.request("GET", "/recommendations")
    client.request("GET", "/auth/me", expected=401)
    client.request("GET", "/books/9223372036854775807", expected=404)
    print("PASS: anonymous catalog, metadata, missing-resource and authentication checks")


def lifecycle_checks(base):
    required = ("SMOKE_EMAIL", "SMOKE_PASSWORD", "SMOKE_ADMIN_EMAIL", "SMOKE_ADMIN_PASSWORD")
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise SmokeFailure("--exercise requires environment variables: " + ", ".join(missing))
    admin, reader = Client(base), Client(base)
    admin_user = admin.login(os.environ["SMOKE_ADMIN_EMAIL"], os.environ["SMOKE_ADMIN_PASSWORD"])
    reader_user = reader.login(os.environ["SMOKE_EMAIL"], os.environ["SMOKE_PASSWORD"])
    if admin_user["role"] != "ADMIN" or reader_user["role"] != "READER":
        raise SmokeFailure("Use a real administrator and a separate reader account")
    if admin_user["id"] == reader_user["id"]:
        raise SmokeFailure("Use separate reader and administrator accounts")
    reader.request("GET", "/admin/books", expected=403)
    title = "Smoke verification " + uuid.uuid4().hex[:12]
    book = admin.request("POST", "/admin/books", {
        "title": title,
        "author": "Automated verification",
        "description": "Temporary lifecycle verification record; archived after the check.",
        "category": "Verification",
        "isbn": "",
    }, expected=201)
    book_id, loan_id = book["id"], None
    try:
        admin.request("PUT", f"/admin/books/{book_id}/status", {"status": "PUBLISHED"})
        detail = reader.request("GET", f"/books/{book_id}")
        if not detail["available"]:
            raise SmokeFailure("Newly published test book is unavailable")
        loan = reader.request("POST", "/loans", {"bookId": book_id}, expected=201)
        loan_id = loan["id"]
        loans = reader.request("GET", "/me/loans")
        if not any(item["id"] == loan_id for item in loans):
            raise SmokeFailure("New loan is missing from the reader's current loans")
        reader.request("POST", "/loans", {"bookId": book_id}, expected=409)
        reader.request("PUT", f"/loans/{loan_id}/return", expected=204)
        reader.request("PUT", f"/loans/{loan_id}/return", expected=204)
        history = reader.request("GET", "/me/loans?history=true")
        if not any(item["id"] == loan_id for item in history):
            raise SmokeFailure("Returned loan is missing from history")
        if not reader.request("GET", f"/books/{book_id}")["available"]:
            raise SmokeFailure("Return did not release the license")
        print("PASS: separate identities, admin permissions, publish/borrow/duplicate/return/history lifecycle")
    finally:
        if loan_id is not None:
            admin.request("PUT", f"/admin/loans/{loan_id}/return", expected=204)
        admin.request("PUT", f"/admin/books/{book_id}/status", {"status": "ARCHIVED"})
        print("Cleanup: verification book archived; audit and loan history retained")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8080", help="Web/API origin without /api/v1")
    parser.add_argument("--exercise", action="store_true", help="Also exercise a temporary book; requires account env vars")
    args = parser.parse_args()
    origin = urllib.parse.urlsplit(args.base_url)
    if origin.scheme not in ("http", "https") or not origin.netloc or origin.username:
        parser.error("--base-url must be an HTTP(S) origin without embedded credentials")
    try:
        anonymous_checks(args.base_url)
        if args.exercise:
            lifecycle_checks(args.base_url)
        else:
            print("Authenticated lifecycle was not requested; use --exercise after configuring account env vars")
    except (SmokeFailure, urllib.error.URLError, TimeoutError, KeyError, ValueError) as error:
        print("FAIL: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
