"""Local-first credit report review. Parse a report, find what is inaccurate with its
legal basis, plan and write the disputes, track the deadlines, compare rounds and bureaus."""

from .brand import PRODUCT_NAME
from .util import CreditError

__all__ = ["PRODUCT_NAME", "CreditError", "parse_items", "detect_bureau"]
__version__ = "0.2.0"


def detect_bureau(items):
    """"transunion", "experian", "equifax" or None, from the report's own header text."""
    from . import generic, tu
    return generic.detect(items) or tu.detect(items)


def parse_items(items, report_date=""):
    """Parse text items with the reader for the detected bureau: the TransUnion reader for its
    layout, the template reader (errata.generic) for Experian and Equifax."""
    from . import generic, tu
    from .util import CreditError as E
    b = detect_bureau(items)
    if b == "transunion":
        return tu.parse(items, report_date)
    if b in ("experian", "equifax"):
        return generic.parse(items, report_date, b)
    raise E("parse", "This does not look like a TransUnion, Experian or Equifax report.")
