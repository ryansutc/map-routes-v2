"""Utilities for handling and printing errors during debugging."""
import sys

from django_backend import settings

_RED = "\033[31m"
_RESET = "\033[0m"


def print_debug_error():
    """Print errors to console in red when DEBUG is enabled."""
    if settings.DEBUG:
        import traceback

        print(_RED, file=sys.stderr, end="")
        traceback.print_exc(file=sys.stderr)
        print(_RESET, file=sys.stderr, end="")
