class HscodeError(Exception):
    """Raised for every failure: HTTP errors, network errors and invalid input.

    `status` is the HTTP status, or 0 for errors raised before a response.
    `code` is the API `error` string, or `invalid_request`, `missing_api_key`
    and `network_error` for local failures.
    """

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
